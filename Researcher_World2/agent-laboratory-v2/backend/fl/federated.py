import logging
import random
import numpy as np
from typing import Dict, List, Any, Optional, Tuple

try:
    import tensorflow as tf
    HAS_TF = True
except ImportError:
    tf = None
    HAS_TF = False

# Configurazione logger
logger = logging.getLogger(__name__)
if not HAS_TF:
    logger.warning("TensorFlow not installed. FL system will use numpy-only simulation.")


# =========================================================================
# Numpy-only helpers: 2-layer NN for binary classification
# =========================================================================

def _sigmoid(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, -500, 500)
    return 1.0 / (1.0 + np.exp(-x))

def _relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(0, x)

def _relu_deriv(x: np.ndarray) -> np.ndarray:
    return (x > 0).astype(np.float32)

def _binary_cross_entropy(y_pred: np.ndarray, y_true: np.ndarray) -> float:
    eps = 1e-7
    y_pred = np.clip(y_pred, eps, 1 - eps)
    return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))


def generate_client_data(client_id: str, n_samples: int = 100, seed: int = 0) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate non-IID synthetic data for a client.
    Uses an XOR-like pattern with client-specific distribution shift.
    Input dim = 10, but only first 2 features carry the signal.
    """
    # Deterministic seed from client_id string + global seed
    h = hash(client_id) & 0xFFFFFFFF
    rng = np.random.RandomState(seed ^ h)

    X = rng.randn(n_samples, 10).astype(np.float32)

    # Non-IID: shift the decision boundary per client
    shift = (h % 7) * 0.3 - 0.9  # range ~ [-0.9, 0.9]
    xor_signal = ((X[:, 0] + shift) > 0).astype(np.float32) != (X[:, 1] > 0).astype(np.float32)
    y = xor_signal.reshape(-1, 1).astype(np.float32)

    # Add ~10% label noise for realism
    flip_mask = rng.rand(n_samples) < 0.10
    y[flip_mask] = 1.0 - y[flip_mask]

    return X, y


def numpy_train(
    weights: List[np.ndarray],
    data_x: np.ndarray,
    data_y: np.ndarray,
    epochs: int = 5,
    lr: float = 0.05,
    batch_size: int = 32,
    mu: float = 0.0,
    global_weights: Optional[List[np.ndarray]] = None,
) -> Tuple[List[np.ndarray], float, float]:
    """
    Train a 2-layer NN (10->32 relu ->16 relu ->1 sigmoid) with SGD.

    Returns (updated_weights, final_loss, final_accuracy).
    If mu > 0 and global_weights is provided, adds FedProx proximal term.
    """
    # Unpack: W1(10,32) b1(32) W2(32,16) b2(16) W3(16,1) b3(1)
    W1, b1, W2, b2, W3, b3 = [w.copy() for w in weights]
    n = len(data_x)

    final_loss = 1.0
    final_acc = 0.5

    for _epoch in range(epochs):
        # Shuffle
        idx = np.random.permutation(n)
        epoch_loss = 0.0
        epoch_correct = 0
        batches = 0

        for start in range(0, n, batch_size):
            bi = idx[start:start + batch_size]
            xb = data_x[bi]
            yb = data_y[bi]
            bs = len(xb)

            # --- Forward ---
            z1 = xb @ W1 + b1            # (bs, 32)
            a1 = _relu(z1)
            z2 = a1 @ W2 + b2            # (bs, 16)
            a2 = _relu(z2)
            z3 = a2 @ W3 + b3            # (bs, 1)
            a3 = _sigmoid(z3)

            # --- Loss ---
            loss = _binary_cross_entropy(a3, yb)

            # FedProx proximal term
            if mu > 0 and global_weights is not None:
                prox = 0.0
                for w_local, w_glob in zip([W1, b1, W2, b2, W3, b3], global_weights):
                    prox += np.sum((w_local - w_glob) ** 2)
                loss += (mu / 2.0) * prox

            epoch_loss += loss * bs
            epoch_correct += np.sum((a3 >= 0.5).astype(np.float32) == yb)
            batches += 1

            # --- Backward ---
            dz3 = (a3 - yb) / bs          # (bs, 1)
            dW3 = a2.T @ dz3
            db3 = np.sum(dz3, axis=0)

            da2 = dz3 @ W3.T
            dz2 = da2 * _relu_deriv(z2)
            dW2 = a1.T @ dz2
            db2 = np.sum(dz2, axis=0)

            da1 = dz2 @ W2.T
            dz1 = da1 * _relu_deriv(z1)
            dW1 = xb.T @ dz1
            db1 = np.sum(dz1, axis=0)

            # FedProx gradient contribution
            if mu > 0 and global_weights is not None:
                dW1 += mu * (W1 - global_weights[0])
                db1 += mu * (b1 - global_weights[1])
                dW2 += mu * (W2 - global_weights[2])
                db2 += mu * (b2 - global_weights[3])
                dW3 += mu * (W3 - global_weights[4])
                db3 += mu * (b3 - global_weights[5])

            # --- SGD update ---
            W1 -= lr * dW1
            b1 -= lr * db1
            W2 -= lr * dW2
            b2 -= lr * db2
            W3 -= lr * dW3
            b3 -= lr * db3

        final_loss = epoch_loss / n
        final_acc = epoch_correct / n

    return [W1, b1, W2, b2, W3, b3], float(final_loss), float(final_acc)

class FederatedLearningSystem:
    """
    Sistema di Federated Learning per la simulazione.
    
    Questo sistema gestisce il processo di apprendimento federato,
    inclusa la selezione dei client, l'aggregazione dei modelli e
    la valutazione della convergenza.
    """
    
    def __init__(
        self,
        algorithm: str = "fedavg",
        aggregation_rounds: int = 5,
        client_fraction: float = 0.8,
        model_type: str = "simple_nn",
        mu: float = 0.01,
        seed: int = 42
    ):
        """
        Inizializza il sistema di Federated Learning

        Args:
            algorithm: Algoritmo FL da utilizzare ("fedavg", "fedprox", ecc.)
            aggregation_rounds: Numero di round di aggregazione
            client_fraction: Frazione di client da selezionare per ogni round
            model_type: Tipo di modello da utilizzare
            mu: Coefficiente del termine prossimale per FedProx
            seed: Seed per riproducibilità
        """
        self.algorithm = algorithm
        self.aggregation_rounds = aggregation_rounds
        self.client_fraction = client_fraction
        self.model_type = model_type
        self.mu = mu
        
        # Imposta seed per riproducibilità
        self.random = random.Random(seed)
        if HAS_TF:
            tf.random.set_seed(seed)
        np.random.seed(seed)
        
        # Stato della federazione
        self.round = 0
        self.clients = {}  # ID cliente -> modello cliente
        self.global_model = None
        self.metrics = {
            "accuracy": [],
            "loss": [],
            "communication_overhead": [],
            "privacy_budget": 1.0
        }
        
        # Inizializza il modello globale
        self._initialize_global_model()
        
        logger.info(f"Federated Learning system initialized with algorithm: {algorithm}")
    
    def _initialize_global_model(self):
        """Inizializza il modello globale in base al tipo specificato"""
        if HAS_TF and self.model_type == "simple_nn":
            self.global_model = tf.keras.Sequential([
                tf.keras.layers.Dense(32, activation='relu', input_shape=(10,)),
                tf.keras.layers.Dense(16, activation='relu'),
                tf.keras.layers.Dense(1, activation='sigmoid')
            ])
            self.global_model.compile(
                optimizer='adam',
                loss='binary_crossentropy',
                metrics=['accuracy']
            )
        elif not HAS_TF:
            # Numpy-only simulation: store weights as list of numpy arrays
            self.global_model = [
                np.random.randn(10, 32).astype(np.float32) * 0.1,
                np.zeros(32, dtype=np.float32),
                np.random.randn(32, 16).astype(np.float32) * 0.1,
                np.zeros(16, dtype=np.float32),
                np.random.randn(16, 1).astype(np.float32) * 0.1,
                np.zeros(1, dtype=np.float32),
            ]
        else:
            logger.error(f"Unknown model type: {self.model_type}")

        logger.info(f"Global model initialized: {self.model_type} (TF={'yes' if HAS_TF else 'numpy-sim'})")
    
    def register_client(self, client_id: str):
        """Registra un nuovo client nella federazione"""
        if client_id in self.clients:
            logger.warning(f"Client {client_id} already registered")
            return False
            
        # Crea copia del modello globale per il client
        if HAS_TF:
            client_model = tf.keras.models.clone_model(self.global_model)
            client_model.set_weights(self.global_model.get_weights())
        else:
            client_model = [w.copy() for w in self.global_model]
        
        self.clients[client_id] = {
            "model": client_model,
            "data_size": 0,  # Verrà impostato quando il client riceve dati
            "last_round": -1
        }
        
        logger.info(f"Client {client_id} registered in federation")
        return True
    
    def remove_client(self, client_id: str):
        """Rimuove un client dalla federazione"""
        if client_id not in self.clients:
            logger.warning(f"Client {client_id} not found")
            return False
            
        del self.clients[client_id]
        logger.info(f"Client {client_id} removed from federation")
        return True
    
    def select_clients(self) -> List[str]:
        """Seleziona un sottoinsieme di client per il round corrente"""
        available_clients = list(self.clients.keys())
        
        if not available_clients:
            logger.warning("No clients available for selection")
            return []
            
        num_clients = max(1, int(len(available_clients) * self.client_fraction))
        selected_clients = self.random.sample(available_clients, num_clients)
        
        logger.info(f"Selected {len(selected_clients)} clients for round {self.round}")
        return selected_clients
    
    def train_client(self, client_id: str, data_x: np.ndarray, data_y: np.ndarray) -> Tuple[Dict[str, float], Dict]:
        """
        Addestra il modello di un client sui suoi dati locali
        
        Args:
            client_id: ID del client
            data_x: Features di input
            data_y: Target
            
        Returns:
            Metriche di training e parametri del modello aggiornati
        """
        if client_id not in self.clients:
            logger.error(f"Client {client_id} not registered")
            return {}, {}

        client = self.clients[client_id]
        client_model = client["model"]

        if not HAS_TF:
            # Real numpy training with optional FedProx proximal term
            use_prox = self.algorithm == "fedprox"
            global_w = [w.copy() for w in self.global_model] if use_prox else None
            mu = self.mu if use_prox else 0.0

            updated_weights, loss, accuracy = numpy_train(
                weights=client_model,
                data_x=data_x,
                data_y=data_y,
                epochs=5,
                lr=0.05,
                batch_size=32,
                mu=mu,
                global_weights=global_w,
            )
            # Write back updated weights to client
            for i in range(len(updated_weights)):
                client_model[i] = updated_weights[i]

            client["data_size"] = len(data_x)
            client["last_round"] = self.round
            metrics = {"loss": loss, "accuracy": accuracy}
            logger.info(
                f"Client {client_id} trained (numpy) {len(data_x)} samples | "
                f"loss={loss:.4f} acc={accuracy:.4f}"
            )
            return metrics, [w.copy() for w in client_model]

        # --- TensorFlow path ---
        # Per FedProx, aggiungi il termine prossimale alla loss
        if self.algorithm == "fedprox":
            global_weights = self.global_model.get_weights()

            optimizer = tf.keras.optimizers.Adam()
            loss_fn = tf.keras.losses.BinaryCrossentropy()

            dataset = tf.data.Dataset.from_tensor_slices((data_x, data_y)).batch(32)
            history_loss = []
            history_acc = []

            for epoch in range(5):
                epoch_loss = []
                epoch_acc = []
                for batch_x, batch_y in dataset:
                    with tf.GradientTape() as tape:
                        predictions = client_model(batch_x, training=True)
                        base_loss = loss_fn(batch_y, predictions)
                        prox_term = 0.0
                        for w, w_g in zip(client_model.trainable_weights, global_weights):
                            prox_term += tf.reduce_sum(tf.square(w - w_g))
                        total_loss = base_loss + (self.mu / 2.0) * prox_term

                    grads = tape.gradient(total_loss, client_model.trainable_weights)
                    optimizer.apply_gradients(zip(grads, client_model.trainable_weights))
                    epoch_loss.append(float(total_loss))
                    epoch_acc.append(float(tf.reduce_mean(
                        tf.cast(tf.equal(tf.round(predictions), tf.cast(batch_y, tf.float32)), tf.float32)
                    )))

                history_loss.append(np.mean(epoch_loss))
                history_acc.append(np.mean(epoch_acc))

            class _History:
                def __init__(self, loss, accuracy):
                    self.history = {"loss": loss, "accuracy": accuracy}
            history = _History(history_loss, history_acc)
        else:
            history = client_model.fit(
                data_x, data_y,
                epochs=5,
                batch_size=32,
                verbose=0
            )

        client["data_size"] = len(data_x)
        client["last_round"] = self.round

        metrics = {
            "loss": history.history["loss"][-1],
            "accuracy": history.history["accuracy"][-1] if "accuracy" in history.history else 0
        }
        updated_weights = client_model.get_weights()

        logger.info(f"Client {client_id} trained with {len(data_x)} samples")
        return metrics, updated_weights
    
    def aggregate_models(self, client_updates: Dict[str, Dict],
                         client_metrics: Optional[Dict[str, Dict[str, float]]] = None) -> Dict[str, float]:
        """
        Aggrega i modelli dei client in base all'algoritmo scelto

        Args:
            client_updates: Dizionario di aggiornamenti dei client {client_id: weights}
            client_metrics: Optional per-client metrics {client_id: {"loss": ..., "accuracy": ...}}

        Returns:
            Metriche di aggregazione
        """
        if not client_updates:
            logger.warning("No client updates to aggregate")
            return {}

        # Recupera pesi e dimensioni dei dati
        weights = []
        data_sizes = []

        for client_id, update in client_updates.items():
            if client_id in self.clients:
                weights.append(update)
                data_sizes.append(self.clients[client_id]["data_size"])

        if not weights:
            logger.warning("No valid weights for aggregation")
            return {}

        # Normalizza i pesi in base alla dimensione dei dati
        total_size = sum(data_sizes)
        normalized_weights = [size / total_size for size in data_sizes]

        if self.algorithm == "fedavg":
            avg_weights = self._weighted_average(weights, normalized_weights)
        elif self.algorithm == "fedprox":
            avg_weights = self._weighted_average(weights, normalized_weights)
        else:
            logger.warning(f"Unknown algorithm '{self.algorithm}', falling back to fedavg")
            avg_weights = self._weighted_average(weights, normalized_weights)

        # Aggiorna il modello globale
        if HAS_TF:
            self.global_model.set_weights(avg_weights)
        else:
            self.global_model = avg_weights

        self.round += 1

        # --- Compute aggregated accuracy / loss from client metrics ---
        round_acc = 0.0
        round_loss = 0.0
        if client_metrics:
            for cid, nw in zip(client_updates.keys(), normalized_weights):
                cm = client_metrics.get(cid, {})
                round_acc += cm.get("accuracy", 0.0) * nw
                round_loss += cm.get("loss", 0.0) * nw
        elif not HAS_TF:
            # Evaluate global model on a shared validation set via forward pass
            val_x, val_y = generate_client_data("__global_val__", n_samples=200, seed=42)
            W1, b1, W2, b2, W3, b3 = self.global_model
            a1 = _relu(val_x @ W1 + b1)
            a2 = _relu(a1 @ W2 + b2)
            a3 = _sigmoid(a2 @ W3 + b3)
            round_loss = _binary_cross_entropy(a3, val_y)
            round_acc = float(np.mean((a3 >= 0.5).astype(np.float32) == val_y))

        self.metrics["accuracy"].append(round(round_acc, 4))
        self.metrics["loss"].append(round(round_loss, 4))
        self.metrics["communication_overhead"].append(len(client_updates))

        logger.info(
            f"Round {self.round} aggregated {len(weights)} clients | "
            f"acc={round_acc:.4f} loss={round_loss:.4f}"
        )

        metrics = {
            "round": self.round,
            "clients_participated": len(client_updates),
            "total_clients": len(self.clients),
            "accuracy": round_acc,
            "loss": round_loss,
        }

        return metrics
    
    def _weighted_average(self, weights_list: List[List[np.ndarray]], weight_factors: List[float]) -> List[np.ndarray]:
        """
        Calcola la media pesata dei pesi dei modelli
        
        Args:
            weights_list: Lista di pesi dei modelli
            weight_factors: Fattori di peso per ogni modello
            
        Returns:
            Media pesata dei pesi
        """
        # Verifica input
        if len(weights_list) != len(weight_factors):
            raise ValueError("weights_list and weight_factors must have the same length")
            
        if not weights_list:
            raise ValueError("weights_list cannot be empty")
            
        # Inizializza array risultato
        avg_weights = [np.zeros_like(w) for w in weights_list[0]]
        
        # Calcola media pesata
        for weights, factor in zip(weights_list, weight_factors):
            for i, w in enumerate(weights):
                avg_weights[i] += w * factor
                
        return avg_weights
    
    def get_state(self) -> Dict[str, Any]:
        """Restituisce lo stato attuale del sistema FL"""
        return {
            "algorithm": self.algorithm,
            "round": self.round,
            "client_count": len(self.clients),
            "metrics": self.metrics
        }
    
    def update_client_models(self):
        """Aggiorna i modelli di tutti i client con i pesi del modello globale"""
        if HAS_TF:
            global_weights = self.global_model.get_weights()
            for client_id, client in self.clients.items():
                client["model"].set_weights(global_weights)
        else:
            for client_id, client in self.clients.items():
                client["model"] = [w.copy() for w in self.global_model]

        logger.info(f"Updated {len(self.clients)} client models with global weights")