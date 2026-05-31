/**
 * cluster.js — Production entry point
 *
 * Forks one worker per CPU core. Each worker runs the full Express app.
 * For 10,000+ concurrent users: Railway horizontal scaling + cluster vertical scaling.
 * Under load: a 4-core instance handles ~4x the single-threaded throughput,
 * distributing bcrypt hashing and I/O across cores.
 */
import cluster from 'cluster';
import os from 'os';

const NUM_WORKERS = process.env.WEB_CONCURRENCY
  ? parseInt(process.env.WEB_CONCURRENCY)
  : os.cpus().length;

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} — spawning ${NUM_WORKERS} workers`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[cluster] Worker ${worker.process.pid} died (${signal ?? code}). Restarting...`);
    cluster.fork(); // auto-restart dead workers
  });

  cluster.on('online', (worker) => {
    console.log(`[cluster] Worker ${worker.process.pid} online`);
  });
} else {
  // Each worker imports and runs the Express app
  await import('./dist/index.js');
}
