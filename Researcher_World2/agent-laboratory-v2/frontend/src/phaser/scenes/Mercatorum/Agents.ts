// src/phaser/scenes/Mercatorum/Agents.ts

import { Agent, AgentState } from '../../sprites/Agent';
import { createAgent } from '../../sprites/agentFactory';
import { MERCATORUM_AGENT_CONFIG, MercatorumAgentConfig, IMercatorumLabScene } from './types';

/**
 * Crea tutti gli agenti della scena
 */
export function createAgents(scene: IMercatorumLabScene): void {
  try {
    console.log('Creating agents from configuration');
    
    // Ottieni configurazione per Mercatorum
    const mercatorumConfig = MERCATORUM_AGENT_CONFIG;
    
    if (!mercatorumConfig || !mercatorumConfig.agents || mercatorumConfig.agents.length === 0) {
      console.warn('No agent configuration found for Mercatorum');
      return;
    }
    
    // Crea agenti dalla configurazione
    mercatorumConfig.agents.forEach((agentConfig: MercatorumAgentConfig) => {
      try {
        console.log(`Creating agent: ${agentConfig.name} (${agentConfig.type})`);
        
        // Verifica se la texture esiste
        if (!scene.textures.exists(agentConfig.type)) {
          console.warn(`Texture for ${agentConfig.type} does not exist, creating placeholder`);
          // La creazione del placeholder viene gestita dal modulo Textures
        }
        
        // Crea l'agente con scala aumentata a 5.0
        const agent = createAgent(scene, {
          type: agentConfig.type,
          name: agentConfig.name,
          position: agentConfig.position,
          role: agentConfig.type,
          scale: 5.0, // Aumentato per renderli più grandi rispetto all'ambiente
          // Riduce la velocità per un movimento più naturale
          speed: 25  // Velocità ulteriormente ridotta per agenti più grandi
        });
        
        // Aggiungi l'agente alla scena e alla lista
        scene.add.existing(agent);
        scene.agents.push(agent);
        
        // Imposta lo stato iniziale
        agent.changeState(AgentState.IDLE);
        
        console.log(`Agent ${agentConfig.name} created successfully`);
      } catch (error) {
        console.error(`Error creating agent ${agentConfig.name}:`, error);
      }
    });
    
    console.log(`Created ${scene.agents.length} agents`);
  } catch (error) {
    console.error('Error in createAgents:', error);
  }
}

/**
 * Aggiorna tutti gli agenti
 */
export function updateAgents(scene: IMercatorumLabScene, time: number, delta: number): void {
  scene.agents.forEach((agent: Agent) => {
    if (typeof agent.update === 'function') {
      agent.update(time, delta);
    }
  });
}

/**
 * Stimola movimenti casuali degli agenti
 */
export function stimulateRandomAgentMovement(scene: IMercatorumLabScene): void {
  try {
    const randomAgentIndex = Math.floor(Math.random() * scene.agents.length);
    const agent = scene.agents[randomAgentIndex];
    
    if (agent && agent.getCurrentState() === AgentState.IDLE) {
      // Forza un movimento casuale
      const randomX = Math.random() * scene.cameras.main.width;
      const randomY = Math.random() * scene.cameras.main.height;
      agent.moveTo(randomX, randomY);
    }
  } catch (error) {
    console.error('Error in stimulateRandomAgentMovement:', error);
  }
}

/**
 * Controlla le interazioni tra agenti e con l'ambiente
 */
export function checkInteractions(scene: IMercatorumLabScene): void {
  try {
    // Controlla interazioni agente-agente
    for (let i = 0; i < scene.agents.length; i++) {
      for (let j = i + 1; j < scene.agents.length; j++) {
        const agent1 = scene.agents[i];
        const agent2 = scene.agents[j];
        
        const distance = Phaser.Math.Distance.Between(
          agent1.x, agent1.y,
          agent2.x, agent2.y
        );
        
        // Se gli agenti sono abbastanza vicini, possono interagire
        if (distance < 32) {
          handleAgentInteraction(scene, agent1, agent2);
        }
      }
    }
    
    // Controlla interazioni agente-zona
    scene.agents.forEach((agent: Agent) => {
      scene.interactionZones.forEach((zone: Phaser.GameObjects.Zone) => {
        const bounds = zone.getBounds();
        if (bounds.contains(agent.x, agent.y)) {
          handleZoneInteraction(scene, agent, zone);
        }
      });
    });
  } catch (error) {
    console.error('Error in checkInteractions:', error);
  }
}

/**
 * Gestisce l'interazione tra due agenti
 */
export function handleAgentInteraction(scene: IMercatorumLabScene, agent1: Agent, agent2: Agent): void {
  console.log(`[Agents] Agent ${agent1.name} interacting with ${agent2.name}`);
  
  // Solo il 30% delle interazioni genera un dialogo
  if (Math.random() > 0.3) {
    console.log(`[Agents] No dialog generated for this interaction`);
    return;
  }

  // Crea un dialogo temporaneo
  const dialogBubble = scene.add.text(
    (agent1.x + agent2.x) / 2,
    Math.min(agent1.y, agent2.y) - 30,
    '💬',
    { fontSize: '24px', color: '#000000' }
  );

  // Traccia il dialogo solo se c'è una vera interazione
  if (scene.dialogEventTracker) {
    console.log(`[Agents] Tracking dialog for agent ${agent1.getId()}`);
    scene.dialogEventTracker.trackDialog('standard', agent1.getId());
  } else {
    console.warn('[Agents] DialogEventTracker not available');
    scene.game.events.emit('dialog-created', {
      type: 'standard',
      agentId: agent1.getId()
    });
  }

  // Rimuovi il dialogo dopo un breve ritardo
  scene.time.delayedCall(2000, () => {
    dialogBubble.destroy();
  });
}

/**
 * Gestisce l'interazione tra un agente e una zona
 */
export function handleZoneInteraction(
  scene: IMercatorumLabScene, 
  agent: Agent, 
  zone: Phaser.GameObjects.Zone
): void {
  console.log(`[Agents] Agent ${agent.name} interacting with zone ${zone.name}`);
  
  // Solo il 30% delle interazioni con le zone genera un dialogo
  if (Math.random() > 0.3) {
    console.log(`[Agents] No dialog generated for this zone interaction`);
    return;
  }

  // Crea un'icona sopra l'agente in base alla zona
  let icon = '💭';
  if (zone.name.includes('meeting')) icon = '👥';
  else if (zone.name.includes('library')) icon = '📚';
  else if (zone.name.includes('lab')) icon = '🔬';

  const zoneIcon = scene.add.text(
    agent.x,
    agent.y - 30,
    icon,
    { fontSize: '24px', color: '#000000' }
  );

  // Traccia l'interazione
  if (scene.dialogEventTracker) {
    console.log(`[Agents] Tracking zone interaction for agent ${agent.getId()}`);
    scene.dialogEventTracker.trackDialog('standard', agent.getId());
  } else {
    console.warn('[Agents] DialogEventTracker not available');
    scene.game.events.emit('dialog-created', {
      type: 'standard',
      agentId: agent.getId()
    });
  }

  // Rimuovi l'icona dopo un breve ritardo
  scene.time.delayedCall(2000, () => {
    zoneIcon.destroy();
  });
}