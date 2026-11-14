// frontend/src/phaser/controllers/DialogAnalytics.ts
//
// Full dialog analytics system. Tracks every dialog event with agents,
// positions, proximity, timestamps, and provides aggregated reports.

import Phaser from 'phaser';
import type { Agent } from '../sprites/Agent';

// ── Data structures ──────────────────────────────────────────────────

export interface DialogRecord {
  id: number;
  timestamp: number;          // game time (ms)
  wallClock: string;          // ISO date string
  // Speaker
  speakerId: string;
  speakerName: string;
  speakerRole: string;
  speakerPos: { x: number; y: number };
  speakerRoom: string | null;
  // Target (may be null for solo thoughts)
  targetId: string | null;
  targetName: string | null;
  targetRole: string | null;
  targetPos: { x: number; y: number } | null;
  targetRoom: string | null;
  // Dialog
  text: string;
  dialogCategory: DialogCategory;
  isResponse: boolean;
  isLLM: boolean;
  // Proximity
  distance: number | null;    // pixel distance between agents
  sameRoom: boolean;
  // Movement triggered
  destinationRoom: string | null;
  // FL / cross-lab metadata
  crossLab: boolean;
  labId: string | null;
  flRound: number | null;
}

export type DialogCategory =
  | 'greeting'
  | 'coffee_break'
  | 'meeting_room'
  | 'server_room'
  | 'professor_office'
  | 'role_pair'
  | 'topical'
  | 'thinking'
  | 'state_phrase'
  | 'llm'
  | 'fl_conversation'
  | 'cross_lab_conversation'
  | 'unknown';

export interface CrossLabStats {
  totalCrossLab: number;
  totalIntraLab: number;
  byLabPair: Record<string, number>;
  byFlRound: Record<number, number>;
}

export interface AnalyticsReport {
  totalDialogs: number;
  timespan: { first: string; last: string } | null;
  byCategory: Record<string, number>;
  byAgent: Record<string, { name: string; role: string; count: number; asInitiator: number; asTarget: number }>;
  byRolePair: Record<string, { count: number; avgDistance: number; sameRoomPct: number }>;
  byRoom: Record<string, number>;
  proximityStats: { avgDistance: number; minDistance: number; maxDistance: number; medianDistance: number };
  movementTriggers: Record<string, number>;
  crossLabStats: CrossLabStats;
  recentDialogs: DialogRecord[];
}

// ── Analytics class ──────────────────────────────────────────────────

export class DialogAnalytics {
  private scene: Phaser.Scene;
  private records: DialogRecord[] = [];
  private nextId = 1;
  private maxRecords = 500;         // keep last N in memory
  private persistKey = 'dialog_analytics';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.loadState();
    this.registerEvents();
    console.log(`[DialogAnalytics] Initialized — ${this.records.length} records loaded`);
  }

  // ── Event registration ─────────���───────────────────────────────────

  private registerEvents(): void {
    const ge = this.scene.game.events;

    // Track dialogs created via DialogController → DialogRenderer pipeline
    ge.on('analytics-dialog', this.onDialog, this);

    // Track FL conversations from backend (intra-lab and cross-lab)
    ge.on('analytics-fl-conversation', this.onFLConversation, this);

    // Track room movements
    ge.on('coffee-break', this.onCoffeeBreak, this);
    ge.on('go-to-room', this.onGoToRoom, this);
  }

  destroy(): void {
    const ge = this.scene.game.events;
    ge.off('analytics-dialog', this.onDialog, this);
    ge.off('analytics-fl-conversation', this.onFLConversation, this);
    ge.off('coffee-break', this.onCoffeeBreak, this);
    ge.off('go-to-room', this.onGoToRoom, this);
    this.saveState();
  }

  // ── Event handlers ─────────────────────────────────────────────────

  private onDialog(data: {
    speakerId: string;
    targetId?: string;
    text: string;
    category: DialogCategory;
    isResponse?: boolean;
    isLLM?: boolean;
    destinationRoom?: string;
  }): void {
    const speaker = this.findAgent(data.speakerId);
    const target = data.targetId ? this.findAgent(data.targetId) : null;

    const speakerPos = speaker ? { x: speaker.x, y: speaker.y } : { x: 0, y: 0 };
    const targetPos = target ? { x: target.x, y: target.y } : null;

    const distance = (speakerPos && targetPos)
      ? Phaser.Math.Distance.Between(speakerPos.x, speakerPos.y, targetPos.x, targetPos.y)
      : null;

    const speakerRoom = this.detectRoom(speakerPos.x, speakerPos.y);
    const targetRoom = targetPos ? this.detectRoom(targetPos.x, targetPos.y) : null;

    const record: DialogRecord = {
      id: this.nextId++,
      timestamp: this.scene.time.now,
      wallClock: new Date().toISOString(),
      speakerId: data.speakerId,
      speakerName: speaker?.name ?? data.speakerId,
      speakerRole: speaker?.role ?? 'unknown',
      speakerPos,
      speakerRoom,
      targetId: data.targetId ?? null,
      targetName: target?.name ?? data.targetId ?? null,
      targetRole: target?.role ?? null,
      targetPos,
      targetRoom,
      text: data.text,
      dialogCategory: data.category,
      isResponse: data.isResponse ?? false,
      isLLM: data.isLLM ?? false,
      distance: distance !== null ? Math.round(distance) : null,
      sameRoom: speakerRoom !== null && speakerRoom === targetRoom,
      destinationRoom: data.destinationRoom ?? null,
      crossLab: false,
      labId: null,
      flRound: null,
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    this.saveState();

    // Emit for any UI listener
    this.scene.game.events.emit('analytics-updated', record);
  }

  private onFLConversation(convo: {
    agents: string[];
    roles: string[];
    lab_id: string;
    cross_lab?: boolean;
    round: number;
    dialog: [string, string][];
  }): void {
    this.addFLConversation(convo);
  }

  private lastMovementAgents: string[] = [];
  private lastMovementRoom: string | null = null;

  private onCoffeeBreak(data: { agentIds: string[] }): void {
    this.lastMovementAgents = data.agentIds;
    this.lastMovementRoom = 'break_room';
  }

  private onGoToRoom(data: { agentIds: string[]; room: string }): void {
    this.lastMovementAgents = data.agentIds;
    this.lastMovementRoom = data.room;
  }

  // ── Agent / room helpers ───────────────────────────────────────────

  private findAgent(agentId: string): Agent | null {
    try {
      const child = this.scene.children.getChildren()
        .find((c: any) => c.getId && c.getId() === agentId);
      return (child as Agent) ?? null;
    } catch { return null; }
  }

  private detectRoom(x: number, y: number): string | null {
    try {
      const scene = this.scene as any;
      if (!scene.interactionZones) return null;
      for (const zone of scene.interactionZones) {
        const hw = zone.width / 2;
        const hh = zone.height / 2;
        if (x >= zone.x - hw && x <= zone.x + hw && y >= zone.y - hh && y <= zone.y + hh) {
          return zone.name;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────

  /** Inject FL conversation records from backend (intra-lab or cross-lab). */
  addFLConversation(convo: {
    agents: string[];
    roles: string[];
    lab_id: string;
    cross_lab?: boolean;
    round: number;
    dialog: [string, string][];
  }): void {
    const isCrossLab = convo.cross_lab === true || convo.lab_id.includes('↔');
    const category: DialogCategory = isCrossLab ? 'cross_lab_conversation' : 'fl_conversation';

    for (let i = 0; i < convo.dialog.length; i++) {
      const [speakerName, text] = convo.dialog[i];
      const speakerIdx = convo.agents.indexOf(speakerName);
      const targetIdx = speakerIdx === 0 ? 1 : 0;

      const record: DialogRecord = {
        id: this.nextId++,
        timestamp: this.scene.time.now,
        wallClock: new Date().toISOString(),
        speakerId: speakerName,
        speakerName,
        speakerRole: convo.roles[speakerIdx] ?? 'unknown',
        speakerPos: { x: 0, y: 0 },
        speakerRoom: isCrossLab ? convo.lab_id : null,
        targetId: convo.agents[targetIdx],
        targetName: convo.agents[targetIdx],
        targetRole: convo.roles[targetIdx] ?? 'unknown',
        targetPos: null,
        targetRoom: null,
        text,
        dialogCategory: category,
        isResponse: i > 0,
        isLLM: true,
        distance: null,
        sameRoom: !isCrossLab,
        destinationRoom: null,
        crossLab: isCrossLab,
        labId: convo.lab_id,
        flRound: convo.round,
      };

      this.records.push(record);
    }

    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
    this.saveState();
  }

  /** Get all raw records. */
  getRecords(): DialogRecord[] {
    return [...this.records];
  }

  /** Get full aggregated report. */
  getReport(): AnalyticsReport {
    const recs = this.records;
    const total = recs.length;

    // Timespan
    const timespan = total > 0
      ? { first: recs[0].wallClock, last: recs[total - 1].wallClock }
      : null;

    // By category
    const byCategory: Record<string, number> = {};
    for (const r of recs) {
      byCategory[r.dialogCategory] = (byCategory[r.dialogCategory] || 0) + 1;
    }

    // By agent
    const byAgent: Record<string, { name: string; role: string; count: number; asInitiator: number; asTarget: number }> = {};
    const ensureAgent = (id: string, name: string, role: string) => {
      if (!byAgent[id]) byAgent[id] = { name, role, count: 0, asInitiator: 0, asTarget: 0 };
    };
    for (const r of recs) {
      ensureAgent(r.speakerId, r.speakerName, r.speakerRole);
      byAgent[r.speakerId].count++;
      byAgent[r.speakerId].asInitiator++;
      if (r.targetId) {
        ensureAgent(r.targetId, r.targetName ?? r.targetId, r.targetRole ?? 'unknown');
        byAgent[r.targetId].count++;
        byAgent[r.targetId].asTarget++;
      }
    }

    // By role pair
    const byRolePair: Record<string, { count: number; totalDist: number; sameRoomCount: number }> = {};
    for (const r of recs) {
      if (!r.targetRole) continue;
      const roles = [r.speakerRole.replace(/_portrait$/, '').toLowerCase(),
                     r.targetRole.replace(/_portrait$/, '').toLowerCase()].sort();
      const key = `${roles[0]} ↔ ${roles[1]}`;
      if (!byRolePair[key]) byRolePair[key] = { count: 0, totalDist: 0, sameRoomCount: 0 };
      byRolePair[key].count++;
      if (r.distance !== null) byRolePair[key].totalDist += r.distance;
      if (r.sameRoom) byRolePair[key].sameRoomCount++;
    }
    const rolePairResult: Record<string, { count: number; avgDistance: number; sameRoomPct: number }> = {};
    for (const [k, v] of Object.entries(byRolePair)) {
      rolePairResult[k] = {
        count: v.count,
        avgDistance: v.count > 0 ? Math.round(v.totalDist / v.count) : 0,
        sameRoomPct: v.count > 0 ? Math.round((v.sameRoomCount / v.count) * 100) : 0,
      };
    }

    // By room (speaker room)
    const byRoom: Record<string, number> = {};
    for (const r of recs) {
      const room = r.speakerRoom ?? 'unknown';
      byRoom[room] = (byRoom[room] || 0) + 1;
    }

    // Proximity stats
    const distances = recs.filter(r => r.distance !== null).map(r => r.distance!);
    distances.sort((a, b) => a - b);
    const proximityStats = distances.length > 0 ? {
      avgDistance: Math.round(distances.reduce((a, b) => a + b, 0) / distances.length),
      minDistance: distances[0],
      maxDistance: distances[distances.length - 1],
      medianDistance: distances[Math.floor(distances.length / 2)],
    } : { avgDistance: 0, minDistance: 0, maxDistance: 0, medianDistance: 0 };

    // Movement triggers
    const movementTriggers: Record<string, number> = {};
    for (const r of recs) {
      if (r.destinationRoom) {
        movementTriggers[r.destinationRoom] = (movementTriggers[r.destinationRoom] || 0) + 1;
      }
    }

    // Cross-lab / FL conversation stats
    const crossLabRecs = recs.filter(r => r.crossLab);
    const flRecs = recs.filter(r => r.dialogCategory === 'fl_conversation' || r.dialogCategory === 'cross_lab_conversation');
    const byLabPair: Record<string, number> = {};
    const byFlRound: Record<number, number> = {};
    for (const r of flRecs) {
      if (r.labId) {
        byLabPair[r.labId] = (byLabPair[r.labId] || 0) + 1;
      }
      if (r.flRound !== null) {
        byFlRound[r.flRound] = (byFlRound[r.flRound] || 0) + 1;
      }
    }
    const crossLabStats: CrossLabStats = {
      totalCrossLab: crossLabRecs.length,
      totalIntraLab: flRecs.length - crossLabRecs.length,
      byLabPair,
      byFlRound,
    };

    return {
      totalDialogs: total,
      timespan,
      byCategory,
      byAgent,
      byRolePair: rolePairResult,
      byRoom,
      proximityStats,
      movementTriggers,
      crossLabStats,
      recentDialogs: recs.slice(-20),
    };
  }

  /** Print a formatted report to console. */
  printReport(): void {
    const r = this.getReport();
    console.group('%c📊 Dialog Analytics Report', 'font-size:14px;font-weight:bold;color:#1565c0');

    console.log(`Total dialogs: ${r.totalDialogs}`);
    if (r.timespan) console.log(`Period: ${r.timespan.first} → ${r.timespan.last}`);

    console.group('By Category');
    console.table(r.byCategory);
    console.groupEnd();

    console.group('By Agent');
    console.table(r.byAgent);
    console.groupEnd();

    console.group('By Role Pair');
    console.table(r.byRolePair);
    console.groupEnd();

    console.group('By Room');
    console.table(r.byRoom);
    console.groupEnd();

    console.group('Proximity');
    console.table(r.proximityStats);
    console.groupEnd();

    console.group('Movement Triggers');
    console.table(r.movementTriggers);
    console.groupEnd();

    console.group('FL & Cross-Lab');
    console.log(`Intra-lab FL: ${r.crossLabStats.totalIntraLab}`);
    console.log(`Cross-lab: ${r.crossLabStats.totalCrossLab}`);
    console.table(r.crossLabStats.byLabPair);
    console.table(r.crossLabStats.byFlRound);
    console.groupEnd();

    console.group('Last 10 Dialogs');
    for (const d of r.recentDialogs.slice(-10)) {
      const dist = d.distance !== null ? `${d.distance}px` : '-';
      const target = d.targetName ? ` → ${d.targetName}` : '';
      const room = d.speakerRoom ?? '?';
      console.log(
        `[${d.wallClock.slice(11, 19)}] ${d.speakerName}${target} | ${d.dialogCategory} | room:${room} | dist:${dist} | "${d.text.slice(0, 60)}${d.text.length > 60 ? '...' : ''}"`,
      );
    }
    console.groupEnd();

    console.groupEnd();
  }

  /** Reset all records. */
  reset(): void {
    this.records = [];
    this.nextId = 1;
    this.saveState();
    console.log('[DialogAnalytics] Reset — all records cleared');
  }

  // ── CSV Export ────────────────────────────────────────────────────

  /** Export all records as CSV string for R/Python analysis. */
  exportCSV(): string {
    const headers = [
      'id', 'timestamp', 'wallClock',
      'speakerId', 'speakerName', 'speakerRole', 'speakerX', 'speakerY', 'speakerRoom',
      'targetId', 'targetName', 'targetRole', 'targetX', 'targetY', 'targetRoom',
      'text', 'dialogCategory', 'isResponse', 'isLLM',
      'distance', 'sameRoom', 'destinationRoom',
      'crossLab', 'labId', 'flRound',
    ];

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const rows = this.records.map(r => [
      r.id, r.timestamp, r.wallClock,
      r.speakerId, r.speakerName, r.speakerRole,
      r.speakerPos.x, r.speakerPos.y, r.speakerRoom,
      r.targetId, r.targetName, r.targetRole,
      r.targetPos?.x ?? '', r.targetPos?.y ?? '', r.targetRoom,
      r.text, r.dialogCategory, r.isResponse, r.isLLM,
      r.distance, r.sameRoom, r.destinationRoom,
      r.crossLab, r.labId, r.flRound,
    ].map(escape).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /** Trigger browser download of CSV file. */
  downloadCSV(filename = 'dialog_analytics.csv'): void {
    const csv = this.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[DialogAnalytics] CSV exported: ${this.records.length} records → ${filename}`);
  }

  // ── Persistence ──────────────��─────────────────────────────────────

  private saveState(): void {
    try {
      // Save only last maxRecords, compacted
      const data = { nextId: this.nextId, records: this.records };
      localStorage.setItem(this.persistKey, JSON.stringify(data));
    } catch { /* storage full or unavailable */ }
  }

  private loadState(): void {
    try {
      const raw = localStorage.getItem(this.persistKey);
      if (raw) {
        const data = JSON.parse(raw);
        this.records = data.records || [];
        this.nextId = data.nextId || this.records.length + 1;
      }
    } catch { /* ignore */ }
  }
}
