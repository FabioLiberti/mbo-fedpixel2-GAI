import logging
import random
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import tensorflow as tf

# Configurazione logger
logger = logging.getLogger(__name__)

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
        if self.model_type == "simple_nn":
            # Semplice modello feed-forward per demo
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
        else:
            logger.error(f"Unknown model type: {self.model_type}")
            
        logger.info(f"Global model initialized: {self.model_type}")
    
    def register_client(self, client_id: str):
        """Registra un nuovo client nella federazione"""
        if client_id in self.clients:
            logger.warning(f"Client {client_id} already registered")
            return False
            
        # Crea copia del modello globale per il client
        client_model = tf.keras.models.clone_model(self.global_model)
        client_model.set_weights(self.global_model.get_weights())
        
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

        # Per FedProx, aggiungi il termine prossimale alla loss
        if self.algorithm == "fedprox":
            global_weights = self.global_model.get_weights()

            # Custom training con termine prossimale mu/2 * ||w - w_global||^2
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
                        # Termine prossimale: mu/2 * sum(||w_i - w_global_i||^2)
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

            # Costruisci un oggetto history-like
            class _History:
                def __init__(self, loss, accuracy):
                    self.history = {"loss": loss, "accuracy": accuracy}
            history = _History(history_loss, history_acc)
        else:
            # FedAvg: training standard
            history = client_model.fit(
                data_x, data_y,
                epochs=5,
                batch_size=32,
                verbose=0
            )
        
        # Aggiorna le informazioni del client
        client["data_size"] = len(data_x)
        client["last_round"] = self.round
        
        # Estrai metriche dal training
        metrics = {
            "loss": history.history["loss"][-1],
            "accuracy": history.history["accuracy"][-1] if "accuracy" in history.history else 0
        }
        
        # Ottieni i pesi aggiornati
        updated_weights = client_model.get_weights()
        
        logger.info(f"Client {client_id} trained with {len(data_x)} samples")
        return metrics, updated_weights
    
    def aggregate_models(self, client_updates: Dict[str, Dict]) -> Dict[str, float]:
        """
        Aggrega i modelli dei client in base all'algoritmo scelto
        
        Args:
            client_updates: Dizionario di aggiornamenti dei client {client_id: weights}
            
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
            # FedAvg: media pesata standard
            avg_weights = self._weighted_average(weights, normalized_weights)

        elif self.algorithm == "fedprox":
            # FedProx: media pesata con termine prossimale
            # Il termine prossimale mu * ||w - w_global||^2 viene applicato
            # durante il training locale (lato client). L'aggregazione è
            # identica a FedAvg; la differenza è nella loss del client.
            avg_weights = self._weighted_average(weights, normalized_weights)

        else:
            logger.warning(f"Unknown algorithm '{self.algorithm}', falling back to fedavg")
            avg_weights = self._weighted_average(weights, normalized_weights)

        # Aggiorna il modello globale
        self.global_model.set_weights(avg_weights)

        logger.info(f"Aggregated models from {len(weights)} clients using {self.algorithm} in round {self.round}")
            
        self.round += 1
        
        # Calcola e restituisci metriche di aggregazione
        metrics = {
            "round": self.round,
            "clients_participated": len(client_updates),
            "total_clients": len(self.clients)
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
        global_weights = self.global_model.get_weights()
        
        for client_id, client in self.clients.items():
            client["model"].set_weights(global_weights)
            
        logger.info(f"Updated {len(self.clients)} client models with global weights")