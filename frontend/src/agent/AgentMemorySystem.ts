export enum MemoryType {
  SHORT_TERM = 'short_term',
  LONG_TERM = 'long_term',
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
}

export interface Memory {
  id: string;
  type: MemoryType;
  content: any;
  importance: number;
  timestamp: string;
  lastAccessed?: string;
  accessCount?: number;
  associations?: string[];
  decay?: number;
}

export interface MemoryQuery {
  type?: MemoryType;
  timeRange?: { start: string; end: string };
  importanceThreshold?: number;
  keywords?: string[];
  limit?: number;
}

export interface MemoryConsolidationResult {
  consolidated: Memory[];
  forgotten: string[];
  insights: string[];
}

const MEMORY_CONFIG = {
  shortTermCapacity: 7,
  longTermCapacity: 1000,
  workingCapacity: 5,
  decayRate: 0.1,
  importanceThreshold: 0.5,
  consolidationInterval: 24 * 60 * 60 * 1000,
};

export class AgentMemorySystem {
  private shortTermMemory: Memory[] = [];
  private longTermMemory: Memory[] = [];
  private workingMemory: Memory[] = [];
  private episodicMemory: Memory[] = [];
  private semanticMemory: Memory[] = [];
  
  private lastConsolidation: string;
  private memoryIndex: Map<string, Memory> = new Map();

  constructor() {
    this.lastConsolidation = new Date().toISOString();
  }

  store(memory: Omit<Memory, 'id'>): Memory {
    const fullMemory: Memory = {
      ...memory,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastAccessed: new Date().toISOString(),
      accessCount: 0,
      associations: [],
      decay: 1.0,
    };

    switch (memory.type) {
      case MemoryType.SHORT_TERM:
        this.addToShortTerm(fullMemory);
        break;
      case MemoryType.LONG_TERM:
        this.addToLongTerm(fullMemory);
        break;
      case MemoryType.WORKING:
        this.addToWorking(fullMemory);
        break;
      case MemoryType.EPISODIC:
        this.addToEpisodic(fullMemory);
        break;
      case MemoryType.SEMANTIC:
        this.addToSemantic(fullMemory);
        break;
    }

    this.memoryIndex.set(fullMemory.id, fullMemory);
    this.checkConsolidation();

    return fullMemory;
  }

  retrieve(query: MemoryQuery): Memory[] {
    let memories: Memory[] = [];

    if (query.type) {
      memories = this.getMemoriesByType(query.type);
    } else {
      memories = [
        ...this.shortTermMemory,
        ...this.workingMemory,
        ...this.episodicMemory,
        ...this.semanticMemory,
        ...this.longTermMemory,
      ];
    }

    if (query.timeRange) {
      const start = new Date(query.timeRange.start).getTime();
      const end = new Date(query.timeRange.end).getTime();
      memories = memories.filter(m => {
        const timestamp = new Date(m.timestamp).getTime();
        return timestamp >= start && timestamp <= end;
      });
    }

    if (query.importanceThreshold !== undefined) {
      const threshold = query.importanceThreshold;
      memories = memories.filter(m => m.importance >= threshold);
    }

    if (query.keywords && query.keywords.length > 0) {
      memories = memories.filter(m => {
        const contentStr = JSON.stringify(m.content).toLowerCase();
        return query.keywords!.some(kw => contentStr.includes(kw.toLowerCase()));
      });
    }

    memories.sort((a, b) => {
      const importanceDiff = b.importance - a.importance;
      if (importanceDiff !== 0) return importanceDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    if (query.limit) {
      memories = memories.slice(0, query.limit);
    }

    for (const memory of memories) {
      memory.lastAccessed = new Date().toISOString();
      memory.accessCount = (memory.accessCount || 0) + 1;
    }

    return memories;
  }

  retrieveRecent(type?: MemoryType, limit: number = 10): Memory[] {
    return this.retrieve({ type, limit });
  }

  retrieveImportant(threshold: number = 0.7, limit: number = 10): Memory[] {
    return this.retrieve({ importanceThreshold: threshold, limit });
  }

  retrieveByKeywords(keywords: string[], limit: number = 10): Memory[] {
    return this.retrieve({ keywords, limit });
  }

  forget(memoryId: string): boolean {
    const memory = this.memoryIndex.get(memoryId);
    if (!memory) return false;

    this.shortTermMemory = this.shortTermMemory.filter(m => m.id !== memoryId);
    this.longTermMemory = this.longTermMemory.filter(m => m.id !== memoryId);
    this.workingMemory = this.workingMemory.filter(m => m.id !== memoryId);
    this.episodicMemory = this.episodicMemory.filter(m => m.id !== memoryId);
    this.semanticMemory = this.semanticMemory.filter(m => m.id !== memoryId);

    this.memoryIndex.delete(memoryId);
    return true;
  }

  consolidate(): MemoryConsolidationResult {
    const consolidated: Memory[] = [];
    const forgotten: string[] = [];
    const insights: string[] = [];

    const shortTermToConsolidate = this.shortTermMemory.filter(
      m => m.importance >= MEMORY_CONFIG.importanceThreshold && (m.accessCount || 0) > 0
    );

    for (const memory of shortTermToConsolidate) {
      const longTermMemory: Memory = {
        ...memory,
        type: MemoryType.LONG_TERM,
        decay: 1.0,
      };
      this.addToLongTerm(longTermMemory);
      consolidated.push(longTermMemory);
    }

    const now = Date.now();
    for (const memory of this.longTermMemory) {
      const age = now - new Date(memory.timestamp).getTime();
      const decayAmount = MEMORY_CONFIG.decayRate * (age / MEMORY_CONFIG.consolidationInterval);
      memory.decay = Math.max(0, (memory.decay || 1.0) - decayAmount);

      if (memory.decay < 0.1 && (memory.accessCount || 0) < 2) {
        this.forget(memory.id);
        forgotten.push(memory.id);
      }
    }

    const patterns = this.extractPatterns();
    insights.push(...patterns);

    this.lastConsolidation = new Date().toISOString();

    return { consolidated, forgotten, insights };
  }

  associate(memoryId1: string, memoryId2: string): boolean {
    const memory1 = this.memoryIndex.get(memoryId1);
    const memory2 = this.memoryIndex.get(memoryId2);

    if (!memory1 || !memory2) return false;

    if (!memory1.associations) memory1.associations = [];
    if (!memory2.associations) memory2.associations = [];

    if (!memory1.associations.includes(memoryId2)) {
      memory1.associations.push(memoryId2);
    }
    if (!memory2.associations.includes(memoryId1)) {
      memory2.associations.push(memoryId1);
    }

    return true;
  }

  getAssociatedMemories(memoryId: string): Memory[] {
    const memory = this.memoryIndex.get(memoryId);
    if (!memory || !memory.associations) return [];

    return memory.associations
      .map(id => this.memoryIndex.get(id))
      .filter((m): m is Memory => m !== undefined);
  }

  getMemoryStats(): {
    total: number;
    byType: Record<MemoryType, number>;
    averageImportance: number;
    oldestMemory?: string;
    newestMemory?: string;
  } {
    const allMemories = [
      ...this.shortTermMemory,
      ...this.longTermMemory,
      ...this.workingMemory,
      ...this.episodicMemory,
      ...this.semanticMemory,
    ];

    const byType: Record<MemoryType, number> = {
      [MemoryType.SHORT_TERM]: this.shortTermMemory.length,
      [MemoryType.LONG_TERM]: this.longTermMemory.length,
      [MemoryType.WORKING]: this.workingMemory.length,
      [MemoryType.EPISODIC]: this.episodicMemory.length,
      [MemoryType.SEMANTIC]: this.semanticMemory.length,
    };

    const averageImportance = allMemories.length > 0
      ? allMemories.reduce((sum, m) => sum + m.importance, 0) / allMemories.length
      : 0;

    const sorted = [...allMemories].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      total: allMemories.length,
      byType,
      averageImportance,
      oldestMemory: sorted[0]?.timestamp,
      newestMemory: sorted[sorted.length - 1]?.timestamp,
    };
  }

  clear(type?: MemoryType): void {
    if (type) {
      switch (type) {
        case MemoryType.SHORT_TERM:
          this.shortTermMemory.forEach(m => this.memoryIndex.delete(m.id));
          this.shortTermMemory = [];
          break;
        case MemoryType.LONG_TERM:
          this.longTermMemory.forEach(m => this.memoryIndex.delete(m.id));
          this.longTermMemory = [];
          break;
        case MemoryType.WORKING:
          this.workingMemory.forEach(m => this.memoryIndex.delete(m.id));
          this.workingMemory = [];
          break;
        case MemoryType.EPISODIC:
          this.episodicMemory.forEach(m => this.memoryIndex.delete(m.id));
          this.episodicMemory = [];
          break;
        case MemoryType.SEMANTIC:
          this.semanticMemory.forEach(m => this.memoryIndex.delete(m.id));
          this.semanticMemory = [];
          break;
      }
    } else {
      this.shortTermMemory = [];
      this.longTermMemory = [];
      this.workingMemory = [];
      this.episodicMemory = [];
      this.semanticMemory = [];
      this.memoryIndex.clear();
    }
  }

  private addToShortTerm(memory: Memory): void {
    this.shortTermMemory.push(memory);
    if (this.shortTermMemory.length > MEMORY_CONFIG.shortTermCapacity) {
      const oldest = this.shortTermMemory.shift();
      if (oldest) {
        this.memoryIndex.delete(oldest.id);
      }
    }
  }

  private addToLongTerm(memory: Memory): void {
    this.longTermMemory.push(memory);
    if (this.longTermMemory.length > MEMORY_CONFIG.longTermCapacity) {
      this.longTermMemory.sort((a, b) => b.importance - a.importance);
      const removed = this.longTermMemory.pop();
      if (removed) {
        this.memoryIndex.delete(removed.id);
      }
    }
  }

  private addToWorking(memory: Memory): void {
    this.workingMemory.push(memory);
    if (this.workingMemory.length > MEMORY_CONFIG.workingCapacity) {
      const oldest = this.workingMemory.shift();
      if (oldest) {
        this.memoryIndex.delete(oldest.id);
      }
    }
  }

  private addToEpisodic(memory: Memory): void {
    this.episodicMemory.push(memory);
    this.episodicMemory.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (this.episodicMemory.length > 100) {
      const removed = this.episodicMemory.pop();
      if (removed) {
        this.memoryIndex.delete(removed.id);
      }
    }
  }

  private addToSemantic(memory: Memory): void {
    const existing = this.semanticMemory.find(m => 
      JSON.stringify(m.content) === JSON.stringify(memory.content)
    );
    
    if (existing) {
      existing.importance = Math.max(existing.importance, memory.importance);
      existing.accessCount = (existing.accessCount || 0) + 1;
    } else {
      this.semanticMemory.push(memory);
    }
  }

  private getMemoriesByType(type: MemoryType): Memory[] {
    switch (type) {
      case MemoryType.SHORT_TERM:
        return [...this.shortTermMemory];
      case MemoryType.LONG_TERM:
        return [...this.longTermMemory];
      case MemoryType.WORKING:
        return [...this.workingMemory];
      case MemoryType.EPISODIC:
        return [...this.episodicMemory];
      case MemoryType.SEMANTIC:
        return [...this.semanticMemory];
      default:
        return [];
    }
  }

  private checkConsolidation(): void {
    const now = Date.now();
    const lastConsolidationTime = new Date(this.lastConsolidation).getTime();
    
    if (now - lastConsolidationTime > MEMORY_CONFIG.consolidationInterval) {
      this.consolidate();
    }
  }

  private extractPatterns(): string[] {
    const insights: string[] = [];

    const recentEpisodes = this.episodicMemory.slice(0, 20);
    
    const typeCounts: Record<string, number> = {};
    for (const episode of recentEpisodes) {
      const type = episode.content?.type;
      if (type) {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      }
    }

    for (const [type, count] of Object.entries(typeCounts)) {
      if (count >= 3) {
        insights.push(`频繁出现 ${type} 类型的记忆，可能需要关注`);
      }
    }

    const highImportanceMemories = this.longTermMemory.filter(m => m.importance > 0.8);
    if (highImportanceMemories.length > 10) {
      insights.push('存在多个高重要性记忆，建议进行知识总结');
    }

    return insights;
  }
}
