// frontend/src/phaser/utils/textureDebugHelper.ts

/**
 * Funzione di utility per diagnosticare problemi con le texture in Phaser
 * 
 * @param scene La scena Phaser in cui eseguire la diagnostica
 */
export function debugTextures(scene: Phaser.Scene): void {
  console.log('------------- TEXTURE DEBUG START -------------');
  
  // Log di tutte le texture disponibili
  const textureKeys = scene.textures.getTextureKeys();
  console.log(`Numero totale di texture: ${textureKeys.length}`);
  console.log('Texture disponibili:', textureKeys);
  
  // Log dettagliato delle texture dei personaggi
  const characterTextures = [
    'professor', 'researcher', 'student', 'doctor',
    'professor_sprites', 'researcher_sprites',
    'professor_chars', 'researcher_chars',
    'professor_specific', 'researcher_specific',
    'professor_agent', 'researcher_agent'
  ];
  
  console.log('\nDettagli texture personaggi:');
  characterTextures.forEach(key => {
    if (scene.textures.exists(key)) {
      const texture = scene.textures.get(key);
      console.log(`✅ ${key}:`);
      console.log(`   - Frame totali: ${texture.frameTotal}`);
      console.log(`   - Dimensioni: ${texture.source[0].width}x${texture.source[0].height}`);
      console.log(`   - Chiave fonte: ${texture.source[0].glTexture ? 'GL Texture' : 'Canvas'}`);
    } else {
      console.log(`❌ ${key}: Non trovata`);
    }
  });
  
  // Log delle animazioni
  console.log('\nAnimazioni create:');
  const animations = scene.anims.anims.entries;
  let animCount = 0;
  
  for (const key in animations) {
    if (Object.prototype.hasOwnProperty.call(animations, key)) {
      animCount++;
      const anim = animations[key];
      console.log(`Animation: ${key}`);
      console.log(`  - Frames: ${anim.frames.length}`);
      console.log(`  - FrameRate: ${anim.frameRate}`);
      console.log(`  - Repeat: ${anim.repeat}`);
      console.log(`  - Texture Key: ${anim.frames[0]?.textureKey || 'N/A'}`);
    }
  }
  
  console.log(`Totale animazioni: ${animCount}`);
  
  // Log agenti esistenti
  if (scene.children && scene.children.list) {
    console.log('\nAgenti nella scena:');
    // Fix: Tipizzazione esplicita per evitare l'errore "Parameter 'obj' implicitly has an 'any' type"
    const agents = scene.children.list.filter((obj: Phaser.GameObjects.GameObject) => {
      // Safe type checking
      if (obj.type === 'Sprite') {
        const spriteObj = obj as Phaser.GameObjects.Sprite;
        return spriteObj.name !== undefined && spriteObj.name !== '';
      }
      return false;
    });
    
    agents.forEach((agent: Phaser.GameObjects.Sprite) => {
      console.log(`Agent: ${agent.name || 'Unnamed'}`);
      console.log(`  - Texture: ${agent.texture?.key || 'No texture'}`);
      console.log(`  - Frame: ${agent.frame?.name || '0'}`);
      console.log(`  - Position: (${agent.x}, ${agent.y})`);
      console.log(`  - Visible: ${agent.visible}`);
      console.log(`  - Alpha: ${agent.alpha}`);
      console.log(`  - Scale: (${agent.scaleX}, ${agent.scaleY})`);
      
      // Controlla se il texture frame esiste
      if (agent.texture && agent.texture.key) {
        const textureKey = agent.texture.key;
        const frameTotal = scene.textures.get(textureKey).frameTotal;
        console.log(`  - Texture frame total: ${frameTotal}`);
      }
    });
  }
  
  // Verifica problemi con WebGL
  try {
    const renderer = scene.game.renderer;
    if (renderer) {
      console.log('\nDettagli Renderer:');
      console.log(`  - Tipo: ${renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}`);
      
      // Fix: Verifica delle proprietà in modo sicuro
      const webGLInfo = {
        type: renderer.type,
        contextLost: 'contextLost' in renderer ? (renderer as Phaser.Renderer.WebGL.WebGLRenderer).contextLost : false
      };
      
      console.log(`  - WebGL Info: ${JSON.stringify(webGLInfo)}`);
    }
  } catch (e) {
    console.log('\nImpossibile ottenere informazioni sul renderer:', e);
  }
  
  console.log('------------- TEXTURE DEBUG END -------------');
}

/**
 * Funzione per visualizzare informazioni su una texture specifica
 * 
 * @param scene La scena Phaser da cui accedere alle texture
 * @param key La chiave della texture da esaminare
 */
export function debugTextureKey(scene: Phaser.Scene, key: string): void {
  console.log(`Debug dettagliato della texture: ${key}`);
  
  if (!scene.textures.exists(key)) {
    console.log(`❌ La texture '${key}' non esiste!`);
    return;
  }
  
  const texture = scene.textures.get(key);
  console.log('Dettagli texture:');
  console.log(`- Frame totali: ${texture.frameTotal}`);
  console.log(`- Dimensioni: ${texture.source[0].width}x${texture.source[0].height}`);
  
  console.log('\nFrames:');
  if (texture.frames) {
    Object.keys(texture.frames).forEach(frameName => {
      const frame = texture.frames[frameName];
      console.log(`- Frame ${frameName}:`);
      console.log(`  - Dimensioni: ${frame.width}x${frame.height}`);
      console.log(`  - Posizione: (${frame.x}, ${frame.y})`);
      console.log(`  - Nome: ${frame.name}`);
    });
  } else {
    console.log('Nessun frame trovato');
  }
}

/**
 * Crea un test visivo per una texture
 * 
 * @param scene La scena Phaser in cui aggiungere il test visivo
 * @param key La chiave della texture da testare
 * @param x La posizione X del test
 * @param y La posizione Y del test
 */
export function createTextureTest(scene: Phaser.Scene, key: string, x: number = 200, y: number = 200): Phaser.GameObjects.Container | undefined {
  if (!scene.textures.exists(key)) {
    console.log(`❌ Impossibile testare visivamente la texture '${key}': non esiste`);
    
    // Crea un placeholder visivo per indicare la texture mancante
    const text = scene.add.text(x, y, `Missing Texture: ${key}`, {
      backgroundColor: '#ff00ff',
      color: '#ffffff',
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    });
    text.setOrigin(0.5);
    return undefined;
  }
  
  console.log(`Creando test visivo per la texture: ${key}`);
  
  // Crea un contenitore per il test
  const container = scene.add.container(x, y);
  
  // Aggiungi lo sprite della texture
  const sprite = scene.add.sprite(0, 0, key);
  container.add(sprite);
  
  // Aggiungi il testo con il nome della texture
  const text = scene.add.text(0, sprite.height / 2 + 10, key, {
    backgroundColor: '#000000',
    color: '#ffffff',
    padding: { left: 5, right: 5, top: 2, bottom: 2 }
  });
  text.setOrigin(0.5, 0);
  container.add(text);
  
  // Aggiungi pulsanti per cambiare frame (se ci sono più frame)
  const texture = scene.textures.get(key);
  if (texture.frameTotal > 1) {
    const prevButton = scene.add.text(-50, 0, '<', {
      backgroundColor: '#333333',
      color: '#ffffff',
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    });
    prevButton.setOrigin(0.5);
    prevButton.setInteractive();
    
    const nextButton = scene.add.text(50, 0, '>', {
      backgroundColor: '#333333',
      color: '#ffffff',
      padding: { left: 10, right: 10, top: 5, bottom: 5 }
    });
    nextButton.setOrigin(0.5);
    nextButton.setInteractive();
    
    // Frame counter
    const frameText = scene.add.text(0, -sprite.height / 2 - 20, 'Frame: 0', {
      backgroundColor: '#000000',
      color: '#ffffff',
      padding: { left: 5, right: 5, top: 2, bottom: 2 }
    });
    frameText.setOrigin(0.5, 1);
    
    // Logica per cambiare frame
    let currentFrame = 0;
    
    const updateFrame = () => {
      sprite.setFrame(currentFrame);
      frameText.setText(`Frame: ${currentFrame}/${texture.frameTotal - 1}`);
    };
    
    prevButton.on('pointerdown', () => {
      currentFrame = (currentFrame - 1 + texture.frameTotal) % texture.frameTotal;
      updateFrame();
    });
    
    nextButton.on('pointerdown', () => {
      currentFrame = (currentFrame + 1) % texture.frameTotal;
      updateFrame();
    });
    
    container.add([prevButton, nextButton, frameText]);
  }
  
  return container;
}