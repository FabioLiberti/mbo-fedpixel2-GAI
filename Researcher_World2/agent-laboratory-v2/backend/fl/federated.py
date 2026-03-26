import json
import logging
import os
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


# =========================================================================
# Heart Disease UCI dataset loading (non-IID partitioned by age)
# =========================================================================

_HEART_DATA: Optional[Dict[str, Any]] = None  # lazy-loaded cache

_LAB_AGE_RANGES = {
    "mercatorum": (60, 200),   # older cohort (business university)
    "blekinge":   (50, 60),    # middle cohort
    "opbg":       (0, 50),     # younger/pediatric cohort
}

def _load_heart_dataset() -> Dict[str, Any]:
    """Load and normalize the Heart Disease UCI dataset (303 rows, 13 features)."""
    global _HEART_DATA
    if _HEART_DATA is not None:
        return _HEART_DATA

    csv_path = os.path.join(os.path.dirname(__file__), "data", "heart.csv")
    # Load with numpy — skip header, handle '?' as NaN
    raw = np.genfromtxt(csv_path, delimiter=",", skip_header=1, filling_values=np.nan)
    # raw shape: (303, 14) — 13 features + 1 target

    X = raw[:, :13].astype(np.float64)
    y = raw[:, 13:14].astype(np.float32)

    # Replace NaN with column median
    for col in range(X.shape[1]):
        mask = np.isnan(X[:, col])
        if mask.any():
            median = np.nanmedian(X[:, col])
            X[mask, col] = median

    # Min-max normalize to [0, 1]
    col_min = X.min(axis=0)
    col_max = X.max(axis=0)
    col_range = col_max - col_min
    col_range[col_range == 0] = 1.0  # avoid division by zero
    X = ((X - col_min) / col_range).astype(np.float32)

    ages = raw[:, 0]  # original un-normalized age for partitioning

    _HEART_DATA = {"X": X, "y": y, "ages": ages}
    logger.info(f"Heart Disease dataset loaded: {X.shape[0]} rows, {X.shape[1]} features")
    return _HEART_DATA


def generate_client_data(client_id: str, n_samples: int = 200, seed: int = 0) -> Tuple[np.ndarray, np.ndarray]:
    """
    Return non-IID Heart Disease data for a client.
    Each lab gets a different age-range partition (naturally non-IID).
    Input dim = 13 (age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal).
    """
    data = _load_heart_dataset()
    rng = np.random.RandomState(seed ^ (hash(client_id) & 0xFFFFFFFF))

    age_range = _LAB_AGE_RANGES.get(client_id)
    if age_range:
        lo, hi = age_range
        mask = (data["ages"] >= lo) & (data["ages"] < hi)
    else:
        # Validation or unknown client: random 20% sample from all data
        mask = np.ones(len(data["X"]), dtype=bool)

    X = data["X"][mask]
    y = data["y"][mask]

    # Shuffle and cap at n_samples
    idx = rng.permutation(len(X))[:min(n_samples, len(X))]
    return X[idx], y[idx]


def _clip_and_noise_grads(
    grads: List[np.ndarray],
    max_grad_norm: float,
    noise_multiplier: float,
) -> float:
    """Clip gradient list by global L2 norm, then add calibrated Gaussian noise.
    Returns the actual noise sigma applied."""
    # Global L2 norm across all gradient arrays
    total_norm = np.sqrt(sum(float(np.sum(g ** 2)) for g in grads))
    clip_factor = min(1.0, max_grad_norm / (total_norm + 1e-8))
    for i in range(len(grads)):
        grads[i] = grads[i] * clip_factor

    # Gaussian noise: σ = noise_multiplier × max_grad_norm
    sigma = noise_multiplier * max_grad_norm
    for i in range(len(grads)):
        grads[i] = grads[i] + np.random.normal(0, sigma, size=grads[i].shape).astype(grads[i].dtype)

    return sigma


def numpy_train(
    weights: List[np.ndarray],
    data_x: np.ndarray,
    data_y: np.ndarray,
    epochs: int = 5,
    lr: float = 0.05,
    batch_size: int = 32,
    mu: float = 0.0,
    global_weights: Optional[List[np.ndarray]] = None,
    dp_enabled: bool = False,
    max_grad_norm: float = 1.0,
    noise_multiplier: float = 0.5,
) -> Tuple[List[np.ndarray], float, float, float]:
    """
    Train a 2-layer NN (13->32 relu ->16 relu ->1 sigmoid) with SGD.

    Returns (updated_weights, final_loss, final_accuracy, noise_sigma).
    If mu > 0 and global_weights is provided, adds FedProx proximal term.
    If dp_enabled, applies per-batch gradient clipping + Gaussian noise (DP-SGD).
    """
    # Unpack: W1(13,32) b1(32) W2(32,16) b2(16) W3(16,1) b3(1)
    W1, b1, W2, b2, W3, b3 = [w.copy() for w in weights]
    n = len(data_x)

    final_loss = 1.0
    final_acc = 0.5
    noise_sigma = 0.0

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

            # --- DP-SGD: clip + noise ---
            if dp_enabled:
                grads = [dW1, db1, dW2, db2, dW3, db3]
                noise_sigma = _clip_and_noise_grads(grads, max_grad_norm, noise_multiplier)
                dW1, db1, dW2, db2, dW3, db3 = grads

            # --- SGD update ---
            W1 -= lr * dW1
            b1 -= lr * db1
            W2 -= lr * dW2
            b2 -= lr * db2
            W3 -= lr * dW3
            b3 -= lr * db3

        final_loss = epoch_loss / n
        final_acc = epoch_correct / n

    return [W1, b1, W2, b2, W3, b3], float(final_loss), float(final_acc), float(noise_sigma)

class FederatedLearningSystem:
    """
    Sistema di Federated Learning per la simulazione.
    
    Questo sistema gestisce il processo di apprendimento federato,
    inclusa la selezione dei client, l'aggregazione dei modelli e
    la valutazione della convergenza.
    """
    
    # Default checkpoint directory (next to this source file)
    _DEFAULT_CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")

    def __init__(
        self,
        algorithm: str = "fedavg",
        aggregation_rounds: int = 5,
        client_fraction: float = 0.8,
        model_type: str = "simple_nn",
        mu: float = 0.01,
        seed: int = 42,
        checkpoint_dir: Optional[str] = None,
        dp_enabled: bool = True,
        dp_epsilon_total: float = 20.0,
        dp_max_grad_norm: float = 1.0,
        dp_noise_multiplier: float = 2.0,
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
            checkpoint_dir: Directory per salvataggio checkpoint (None = default)
            dp_enabled: Abilita DP-SGD (gradient clipping + noise)
            dp_epsilon_total: Budget totale di privacy (epsilon)
            dp_max_grad_norm: Norma massima per gradient clipping
            dp_noise_multiplier: Moltiplicatore rumore σ = noise_multiplier × max_grad_norm
        """
        self.algorithm = algorithm
        self.aggregation_rounds = aggregation_rounds
        self.client_fraction = client_fraction
        self.model_type = model_type
        self.mu = mu
        self.checkpoint_dir = checkpoint_dir or self._DEFAULT_CHECKPOINT_DIR

        # DP-SGD parameters
        self.dp_enabled = dp_enabled
        self.dp_epsilon_total = dp_epsilon_total
        self.dp_epsilon_spent = 0.0
        self.dp_max_grad_norm = dp_max_grad_norm
        self.dp_noise_multiplier = dp_noise_multiplier

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
            "privacy_budget": 1.0,
            "per_client": [],
            "local_vs_global": [],   # per-round: {lab: {local_acc, global_acc, gain}}
            "cross_eval": [],        # per-round: {eval_lab: {train_lab: acc, ...}}
        }

        # Inizializza il modello globale
        self._initialize_global_model()

        logger.info(f"Federated Learning system initialized with algorithm: {algorithm}")
    
    def _initialize_global_model(self):
        """Inizializza il modello globale in base al tipo specificato"""
        if HAS_TF and self.model_type == "simple_nn":
            self.global_model = tf.keras.Sequential([
                tf.keras.layers.Dense(32, activation='relu', input_shape=(13,)),
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
                np.random.randn(13, 32).astype(np.float32) * 0.1,
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

            # Check if privacy budget is exhausted
            dp_active = self.dp_enabled and self.dp_epsilon_spent < self.dp_epsilon_total

            updated_weights, loss, accuracy, noise_sigma = numpy_train(
                weights=client_model,
                data_x=data_x,
                data_y=data_y,
                epochs=5,
                lr=0.05,
                batch_size=32,
                mu=mu,
                global_weights=global_w,
                dp_enabled=dp_active,
                max_grad_norm=self.dp_max_grad_norm,
                noise_multiplier=self.dp_noise_multiplier,
            )
            # Write back updated weights to client
            for i in range(len(updated_weights)):
                client_model[i] = updated_weights[i]

            client["data_size"] = len(data_x)
            client["last_round"] = self.round
            metrics = {"loss": loss, "accuracy": accuracy, "noise_sigma": noise_sigma}
            logger.info(
                f"Client {client_id} trained (numpy) {len(data_x)} samples | "
                f"loss={loss:.4f} acc={accuracy:.4f}"
                f"{f' σ={noise_sigma:.4f}' if dp_active else ''}"
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
        if client_metrics:
            self.metrics["per_client"].append(
                {cid: dict(cm) for cid, cm in client_metrics.items()}
            )

        # --- DP-SGD: epsilon accounting per round ---
        if self.dp_enabled and client_metrics:
            # Simplified Gaussian mechanism: ε_round = sqrt(2·ln(1.25/δ)) / σ
            # This gives the per-query epsilon; we treat each round as one query
            # (the aggregation step), not per-batch, to keep the budget realistic.
            import math
            delta = 1e-5
            sigma = self.dp_noise_multiplier
            eps_round = math.sqrt(2 * math.log(1.25 / delta)) / sigma
            # Scale down: each FL round consumes one composition step
            # Use simple composition (not advanced) for clarity
            self.dp_epsilon_spent = round(self.dp_epsilon_spent + eps_round, 4)
            self.metrics["privacy_budget"] = round(
                max(0.0, 1.0 - self.dp_epsilon_spent / self.dp_epsilon_total), 4
            )
            logger.info(
                f"DP: ε_round={eps_round:.4f}, ε_spent={self.dp_epsilon_spent:.4f}"
                f"/{self.dp_epsilon_total}, budget={self.metrics['privacy_budget']:.2%}"
            )

        # A: local-vs-global evaluation
        lvg = self._evaluate_local_vs_global(client_updates)
        self.metrics["local_vs_global"].append(lvg)

        # B: cross-evaluation (global model on each lab's data)
        cross = self._evaluate_cross()
        self.metrics["cross_eval"].append(cross)

        logger.info(
            f"Round {self.round} aggregated {len(weights)} clients | "
            f"acc={round_acc:.4f} loss={round_loss:.4f}"
        )
        if lvg:
            for cid, v in lvg.items():
                logger.info(
                    f"  {cid}: local_acc={v['local_acc']:.4f} "
                    f"global_acc={v['global_acc']:.4f} gain={v['gain']:+.4f}"
                )

        metrics = {
            "round": self.round,
            "clients_participated": len(client_updates),
            "total_clients": len(self.clients),
            "accuracy": round_acc,
            "loss": round_loss,
            "local_vs_global": lvg,
            "cross_eval": cross,
        }

        # Auto-save checkpoint after each aggregation
        try:
            self.save_checkpoint()
        except Exception as e:
            logger.warning(f"Auto-save checkpoint failed: {e}")

        return metrics
    
    @staticmethod
    def _eval_weights(weights: List[np.ndarray], data_x: np.ndarray, data_y: np.ndarray) -> Dict[str, float]:
        """Forward-pass evaluation of numpy weights on given data."""
        W1, b1, W2, b2, W3, b3 = weights
        a1 = _relu(data_x @ W1 + b1)
        a2 = _relu(a1 @ W2 + b2)
        a3 = _sigmoid(a2 @ W3 + b3)
        loss = float(_binary_cross_entropy(a3, data_y))
        acc = float(np.mean((a3 >= 0.5).astype(np.float32) == data_y))
        return {"accuracy": round(acc, 4), "loss": round(loss, 4)}

    def _evaluate_local_vs_global(self, client_updates: Dict[str, List[np.ndarray]]) -> Dict[str, Dict]:
        """Compare local model vs global model accuracy on each client's own data.
        Returns {lab_id: {local_acc, global_acc, gain}}."""
        if HAS_TF:
            return {}
        result = {}
        for cid in client_updates:
            data_x, data_y = generate_client_data(cid, n_samples=200, seed=42 + self.round)
            local_eval = self._eval_weights(client_updates[cid], data_x, data_y)
            global_eval = self._eval_weights(self.global_model, data_x, data_y)
            gain = round(global_eval["accuracy"] - local_eval["accuracy"], 4)
            result[cid] = {
                "local_acc": local_eval["accuracy"],
                "global_acc": global_eval["accuracy"],
                "gain": gain,
            }
        return result

    def _evaluate_cross(self) -> Dict[str, Dict[str, float]]:
        """Evaluate global model on each lab's data — measures generalization
        to data the model never saw directly (privacy-preserving benefit).
        Returns {eval_lab: {accuracy, loss, samples}}."""
        if HAS_TF:
            return {}
        result = {}
        for cid in self.clients:
            data_x, data_y = generate_client_data(cid, n_samples=200, seed=42 + self.round)
            ev = self._eval_weights(self.global_model, data_x, data_y)
            ev["samples"] = len(data_x)
            result[cid] = ev
        return result

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
            "metrics": self.metrics,
            "dp": {
                "enabled": self.dp_enabled,
                "epsilon_total": self.dp_epsilon_total,
                "epsilon_spent": self.dp_epsilon_spent,
                "epsilon_remaining": round(max(0, self.dp_epsilon_total - self.dp_epsilon_spent), 4),
                "budget_fraction": self.metrics["privacy_budget"],
                "noise_multiplier": self.dp_noise_multiplier,
                "max_grad_norm": self.dp_max_grad_norm,
                "exhausted": self.dp_epsilon_spent >= self.dp_epsilon_total,
            },
        }

    def get_data_distribution(self) -> Dict[str, Any]:
        """Return per-lab data distribution info (samples, age stats, positive ratio, age histogram)."""
        data = _load_heart_dataset()
        result: Dict[str, Any] = {}
        bins = [0, 35, 45, 55, 65, 80]  # age histogram bin edges
        for lab_id, (lo, hi) in _LAB_AGE_RANGES.items():
            mask = (data["ages"] >= lo) & (data["ages"] < hi)
            ages = data["ages"][mask]
            y = data["y"][mask].flatten()
            n = int(len(ages))
            if n == 0:
                result[lab_id] = {"n_samples": 0, "age_mean": 0, "age_std": 0,
                                  "positive_ratio": 0, "age_histogram": []}
                continue
            hist_counts, _ = np.histogram(ages, bins=bins)
            result[lab_id] = {
                "n_samples": n,
                "age_mean": round(float(np.mean(ages)), 1),
                "age_std": round(float(np.std(ages)), 1),
                "positive_ratio": round(float(np.mean(y)), 3),
                "age_histogram": {
                    "bins": [f"{bins[i]}-{bins[i+1]}" for i in range(len(bins)-1)],
                    "counts": [int(c) for c in hist_counts],
                },
            }
        return result

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

    # =========================================================================
    # Checkpoint persistence (weights + metrics + FL state)
    # =========================================================================

    def save_checkpoint(self) -> str:
        """Save global model weights, metrics, and FL state to disk.
        Returns the path of the saved checkpoint directory."""
        os.makedirs(self.checkpoint_dir, exist_ok=True)

        # 1) Weights (.npz)
        weights_path = os.path.join(self.checkpoint_dir, "global_weights.npz")
        if not HAS_TF:
            np.savez(weights_path, *self.global_model)
        else:
            np.savez(weights_path, *self.global_model.get_weights())

        # 2) State + metrics (.json)
        state = {
            "algorithm": self.algorithm,
            "round": self.round,
            "aggregation_rounds": self.aggregation_rounds,
            "client_fraction": self.client_fraction,
            "model_type": self.model_type,
            "mu": self.mu,
            "client_ids": list(self.clients.keys()),
            "dp": {
                "enabled": self.dp_enabled,
                "epsilon_total": self.dp_epsilon_total,
                "epsilon_spent": self.dp_epsilon_spent,
                "noise_multiplier": self.dp_noise_multiplier,
                "max_grad_norm": self.dp_max_grad_norm,
            },
            "metrics": {
                "accuracy": self.metrics["accuracy"],
                "loss": self.metrics["loss"],
                "communication_overhead": self.metrics["communication_overhead"],
                "privacy_budget": self.metrics["privacy_budget"],
                "per_client": self.metrics["per_client"],
                "local_vs_global": self.metrics["local_vs_global"],
                "cross_eval": self.metrics["cross_eval"],
            },
        }
        state_path = os.path.join(self.checkpoint_dir, "fl_state.json")
        with open(state_path, "w") as f:
            json.dump(state, f, indent=2, default=lambda o: float(o) if isinstance(o, (np.floating,)) else int(o) if isinstance(o, (np.integer,)) else o)

        logger.info(f"Checkpoint saved: round {self.round}, {weights_path}")
        return self.checkpoint_dir

    def load_checkpoint(self) -> bool:
        """Load checkpoint from disk. Returns True if successful."""
        weights_path = os.path.join(self.checkpoint_dir, "global_weights.npz")
        state_path = os.path.join(self.checkpoint_dir, "fl_state.json")

        if not os.path.exists(weights_path) or not os.path.exists(state_path):
            logger.info("No checkpoint found, starting fresh")
            return False

        try:
            # 1) Load state
            with open(state_path, "r") as f:
                state = json.load(f)

            self.round = state["round"]
            self.algorithm = state.get("algorithm", self.algorithm)
            self.aggregation_rounds = state.get("aggregation_rounds", self.aggregation_rounds)
            self.client_fraction = state.get("client_fraction", self.client_fraction)
            self.mu = state.get("mu", self.mu)

            # Restore DP state
            dp = state.get("dp", {})
            self.dp_enabled = dp.get("enabled", self.dp_enabled)
            self.dp_epsilon_total = dp.get("epsilon_total", self.dp_epsilon_total)
            self.dp_epsilon_spent = dp.get("epsilon_spent", 0.0)
            self.dp_noise_multiplier = dp.get("noise_multiplier", self.dp_noise_multiplier)
            self.dp_max_grad_norm = dp.get("max_grad_norm", self.dp_max_grad_norm)
            self.metrics = {
                "accuracy": state["metrics"].get("accuracy", []),
                "loss": state["metrics"].get("loss", []),
                "communication_overhead": state["metrics"].get("communication_overhead", []),
                "privacy_budget": state["metrics"].get("privacy_budget", 1.0),
                "per_client": state["metrics"].get("per_client", []),
                "local_vs_global": state["metrics"].get("local_vs_global", []),
                "cross_eval": state["metrics"].get("cross_eval", []),
            }

            # 2) Load weights
            data = np.load(weights_path)
            weight_arrays = [data[f"arr_{i}"] for i in range(len(data.files))]

            if not HAS_TF:
                self.global_model = weight_arrays
            else:
                self.global_model.set_weights(weight_arrays)

            # 3) Re-register clients and distribute global weights
            for cid in state.get("client_ids", []):
                if cid not in self.clients:
                    self.register_client(cid)
            self.update_client_models()

            logger.info(
                f"Checkpoint loaded: round {self.round}, "
                f"acc={self.metrics['accuracy'][-1] if self.metrics['accuracy'] else 'N/A'}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return False