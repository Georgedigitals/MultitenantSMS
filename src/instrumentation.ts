export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundJobWorker } = await import('./lib/queue/job-queue');
    startBackgroundJobWorker();
  }
}
