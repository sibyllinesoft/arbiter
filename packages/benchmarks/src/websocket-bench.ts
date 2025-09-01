import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import type { BenchmarkResult } from './types';

export interface WebSocketBenchmarkConfig {
  url: string;
  connections: number;
  messagesPerConnection: number;
  messageSize: number;
}

export async function websocketBenchmark(config: WebSocketBenchmarkConfig): Promise<BenchmarkResult> {
  const startTime = Date.now();
  
  console.log(`🔌 Testing WebSocket performance with ${config.connections} connections`);
  console.log(`📨 Sending ${config.messagesPerConnection} messages per connection (${config.messageSize} bytes each)`);

  const results = {
    connections: 0,
    messages_sent: 0,
    messages_received: 0,
    connection_times: [] as number[],
    message_latencies: [] as number[],
    errors: 0,
  };

  // Generate test message of specified size
  const testMessage = JSON.stringify({
    type: 'test',
    data: 'x'.repeat(config.messageSize - 50), // Account for JSON overhead
    timestamp: 0, // Will be set per message
  });

  // Connection promises
  const connectionPromises = [];

  for (let i = 0; i < config.connections; i++) {
    const promise = new Promise<void>((resolve, reject) => {
      const connectionStart = performance.now();
      const ws = new WebSocket(config.url);
      const messageTimes = new Map<string, number>();
      let messagesReceived = 0;
      let messagesSent = 0;

      ws.on('open', () => {
        const connectionTime = performance.now() - connectionStart;
        results.connection_times.push(connectionTime);
        results.connections++;

        console.log(`  🔗 Connection ${i + 1} established in ${Math.round(connectionTime)}ms`);

        // Send hello message
        ws.send(JSON.stringify({
          type: 'hello',
          version: '1.0.0'
        }));

        // Start sending test messages after brief delay
        setTimeout(() => {
          for (let j = 0; j < config.messagesPerConnection; j++) {
            const messageId = `${i}-${j}`;
            const message = JSON.parse(testMessage);
            message.id = messageId;
            message.timestamp = performance.now();
            
            ws.send(JSON.stringify(message));
            messageTimes.set(messageId, message.timestamp);
            messagesSent++;
            results.messages_sent++;
          }
        }, 100);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'test' && message.id) {
            const sentTime = messageTimes.get(message.id);
            if (sentTime) {
              const latency = performance.now() - sentTime;
              results.message_latencies.push(latency);
              messagesReceived++;
              results.messages_received++;
            }
          }

          // Close when all messages received
          if (messagesReceived >= config.messagesPerConnection) {
            ws.close();
          }
        } catch (error) {
          results.errors++;
        }
      });

      ws.on('close', () => {
        resolve();
      });

      ws.on('error', (error) => {
        console.error(`  ❌ Connection ${i + 1} error:`, error.message);
        results.errors++;
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        resolve();
      }, 30000);
    });

    connectionPromises.push(promise);

    // Stagger connections to avoid overwhelming server
    if (i % 10 === 9) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Wait for all connections to complete
  await Promise.allSettled(connectionPromises);

  // Calculate statistics
  const avgConnectionTime = results.connection_times.reduce((a, b) => a + b, 0) / results.connection_times.length || 0;
  const avgMessageLatency = results.message_latencies.reduce((a, b) => a + b, 0) / results.message_latencies.length || 0;
  const p95MessageLatency = results.message_latencies.sort((a, b) => a - b)[Math.floor(results.message_latencies.length * 0.95)] || 0;
  const messageDeliveryRate = (results.messages_received / results.messages_sent) * 100;
  
  const totalDuration = Date.now() - startTime;
  const messagesPerSecond = (results.messages_sent / totalDuration) * 1000;

  console.log(`  ⚡ Established ${results.connections} connections`);
  console.log(`  📨 Sent ${results.messages_sent} messages, received ${results.messages_received}`);
  console.log(`  🚀 Messages/sec: ${Math.round(messagesPerSecond)}`);
  console.log(`  ⏱️  Avg message latency: ${Math.round(avgMessageLatency)}ms`);

  return {
    name: 'WebSocket Performance Benchmark',
    type: 'websocket',
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    metrics: {
      connections_established: results.connections,
      messages_sent: results.messages_sent,
      messages_received: results.messages_received,
      message_delivery_rate_percent: Math.round(messageDeliveryRate * 100) / 100,
      avg_connection_time_ms: Math.round(avgConnectionTime * 100) / 100,
      avg_message_latency_ms: Math.round(avgMessageLatency * 100) / 100,
      p95_message_latency_ms: Math.round(p95MessageLatency * 100) / 100,
      messages_per_second: Math.round(messagesPerSecond * 100) / 100,
      error_count: results.errors,
      throughput_mbps: Math.round((results.messages_sent * config.messageSize / totalDuration) * 8 / 1000 * 100) / 100,
    },
    metadata: {
      config,
      raw_latencies: results.message_latencies.slice(0, 1000), // Sample for analysis
    },
  };
}