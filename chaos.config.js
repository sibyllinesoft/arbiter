/**
 * Chaos Testing Configuration
 * 
 * Configuration file for CRDT & WebSocket chaos testing infrastructure.
 * Defines test scenarios, performance targets, and system constraints.
 */

export default {
  // Test execution settings
  execution: {
    timeout: 300000, // 5 minutes default timeout
    maxUsers: 4,     // Maximum concurrent users to simulate
    retries: 2,      // Test retry attempts on failure
  },

  // Network conditions for chaos testing
  networkConditions: {
    normal: {
      latency: 50,
      packetLoss: 0.0,
      bandwidth: 100,
      jitter: 10
    },
    moderate: {
      latency: 200,
      packetLoss: 0.01,
      bandwidth: 80,
      jitter: 50
    },
    severe: {
      latency: 1000,
      packetLoss: 0.1,
      bandwidth: 30,
      jitter: 200
    },
    critical: {
      latency: 3000,
      packetLoss: 0.25,
      bandwidth: 10,
      jitter: 1000
    }
  },

  // Message chaos configuration
  messageChaos: {
    low: {
      delayRange: [0, 500],
      reorderProbability: 0.05,
      duplicateProbability: 0.02,
      dropProbability: 0.01
    },
    medium: {
      delayRange: [0, 2000],
      reorderProbability: 0.15,
      duplicateProbability: 0.05,
      dropProbability: 0.03
    },
    high: {
      delayRange: [0, 5000],
      reorderProbability: 0.30,
      duplicateProbability: 0.10,
      dropProbability: 0.05
    },
    extreme: {
      delayRange: [0, 10000],
      reorderProbability: 0.50,
      duplicateProbability: 0.20,
      dropProbability: 0.10
    }
  },

  // Performance targets and thresholds
  performanceTargets: {
    reliability: {
      minimum: 0.85,    // 85% minimum reliability
      target: 0.95,     // 95% target reliability
      excellent: 0.99   // 99% excellent reliability
    },
    dataIntegrity: {
      minimum: 0.95,    // 95% minimum data integrity
      target: 1.0,      // 100% target (no data loss)
    },
    recoveryTime: {
      maximum: 60000,   // 60 seconds maximum recovery
      target: 30000,    // 30 seconds target
      excellent: 10000  // 10 seconds excellent
    },
    userExperience: {
      minimum: 0.60,    // 60% minimum UX score
      target: 0.80,     // 80% target UX score
      excellent: 0.95   // 95% excellent UX score
    },
    responseTime: {
      normal: 200,      // <200ms normal conditions
      degraded: 1000,   // <1s under degraded conditions
      critical: 5000    // <5s under critical conditions
    }
  },

  // Test scenarios and their configurations
  scenarios: {
    networkPartition: {
      enabled: true,
      duration: 45000,      // 45 seconds
      partitionHealDelay: 10000, // 10 seconds to heal
      concurrentOperations: 10   // Operations during partition
    },
    messageChaos: {
      enabled: true,
      duration: 30000,      // 30 seconds
      chaosLevel: 'medium',
      operationsPerUser: 15
    },
    connectionStorm: {
      enabled: true,
      duration: 60000,      // 1 minute
      reconnectInterval: 2000, // 2 seconds between reconnects
      stormIntensity: 'high'
    },
    degradationRecovery: {
      enabled: true,
      phases: [
        { name: 'normal', duration: 10000, conditions: 'normal' },
        { name: 'moderate', duration: 15000, conditions: 'moderate' },
        { name: 'severe', duration: 20000, conditions: 'severe' },
        { name: 'critical', duration: 10000, conditions: 'critical' },
        { name: 'recovery1', duration: 10000, conditions: 'severe' },
        { name: 'recovery2', duration: 10000, conditions: 'moderate' },
        { name: 'full_recovery', duration: 10000, conditions: 'normal' }
      ]
    },
    crdtStress: {
      enabled: true,
      duration: 40000,      // 40 seconds
      operationsPerSecond: 5,
      conflictIntensity: 'high'
    },
    realWorldScenarios: {
      enabled: true,
      scenarios: [
        {
          name: 'mobile_subway',
          pattern: 'intermittent_connectivity',
          duration: 45000
        },
        {
          name: 'office_wifi',
          pattern: 'periodic_slowdown', 
          duration: 60000
        },
        {
          name: 'server_failover',
          pattern: 'brief_total_disconnect',
          duration: 10000
        }
      ]
    }
  },

  // Test modes configuration
  modes: {
    quick: {
      scenarios: ['networkPartition', 'connectionStorm'],
      networkConditions: ['normal', 'moderate', 'severe'],
      maxUsers: 2,
      timeout: 120000 // 2 minutes
    },
    full: {
      scenarios: ['networkPartition', 'messageChaos', 'connectionStorm', 'degradationRecovery', 'crdtStress', 'realWorldScenarios'],
      networkConditions: ['normal', 'moderate', 'severe', 'critical'],
      maxUsers: 4,
      timeout: 600000 // 10 minutes
    },
    network: {
      scenarios: ['networkPartition', 'messageChaos', 'degradationRecovery'],
      networkConditions: ['normal', 'moderate', 'severe', 'critical'],
      maxUsers: 3,
      timeout: 300000 // 5 minutes
    },
    crdt: {
      scenarios: ['crdtStress', 'networkPartition'],
      networkConditions: ['normal', 'severe'],
      maxUsers: 4,
      timeout: 240000 // 4 minutes
    },
    realworld: {
      scenarios: ['realWorldScenarios', 'degradationRecovery'],
      networkConditions: ['normal', 'moderate', 'severe'],
      maxUsers: 3,
      timeout: 300000 // 5 minutes
    }
  },

  // Reporting configuration
  reporting: {
    outputDir: 'chaos-test-results',
    formats: ['json', 'html'],
    includeRawMetrics: true,
    generateSummary: true,
    exportDetailedLogs: false, // Set to true for debugging
    
    // Report sections to include
    sections: {
      executiveSummary: true,
      performanceMetrics: true,
      reliabilityAnalysis: true,
      failureAnalysis: true,
      recommendations: true,
      trendAnalysis: false // Requires historical data
    }
  },

  // Environment-specific overrides
  environments: {
    ci: {
      execution: {
        timeout: 180000, // 3 minutes for CI
        maxUsers: 2,
        retries: 1
      },
      modes: {
        ci: {
          scenarios: ['networkPartition', 'messageChaos'],
          networkConditions: ['normal', 'moderate'],
          maxUsers: 2,
          timeout: 180000
        }
      }
    },
    development: {
      execution: {
        timeout: 120000, // 2 minutes for dev
        maxUsers: 2,
        retries: 0
      },
      reporting: {
        exportDetailedLogs: true
      }
    },
    staging: {
      // Production-like settings
      execution: {
        timeout: 600000, // 10 minutes
        maxUsers: 6,     // Higher load
        retries: 3
      }
    }
  },

  // Advanced configuration
  advanced: {
    // Custom chaos patterns
    customPatterns: {
      // Add custom network patterns here
    },
    
    // Performance monitoring intervals
    monitoring: {
      metricsInterval: 1000,    // Collect metrics every second
      healthCheckInterval: 5000 // Health checks every 5 seconds
    },
    
    // Debug settings
    debug: {
      enableVerboseLogging: false,
      captureNetworkTraffic: false,
      recordScreenshots: false,
      saveIntermediateStates: false
    }
  }
};