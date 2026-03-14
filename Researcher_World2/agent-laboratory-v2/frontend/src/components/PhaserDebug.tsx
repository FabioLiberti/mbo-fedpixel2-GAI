// PhaserDebug.tsx - Un componente semplice per verificare l'inizializzazione di Phaser
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

const PhaserDebug: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!gameContainerRef.current) return;
    
    // Configurazione base di Phaser
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameContainerRef.current,
      backgroundColor: '#333333',
      scene: {
        preload: function(this: Phaser.Scene) {
          this.load.image('logo', 'assets/placeholder.png');
          console.log('Debug scene preloaded');
        },
        create: function(this: Phaser.Scene) {
          const logo = this.add.image(400, 300, 'logo');
          console.log('Debug scene created');
          
          // Aggiungi un testo per confermare che la scena è stata creata
          this.add.text(400, 400, 'Phaser Debug Scene', {
            fontSize: '24px',
            color: '#ffffff'
          }).setOrigin(0.5);
        }
      }
    };
    
    // Crea una nuova istanza di gioco Phaser
    const game = new Phaser.Game(config);
    
    // Cleanup al momento dello smontaggio del componente
    return () => {
      game.destroy(true);
    };
  }, []);
  
  return (
    <div className="phaser-debug">
      <h2>Phaser Debug Component</h2>
      <div ref={gameContainerRef} className="game-container"></div>
    </div>
  );
};

export default PhaserDebug;