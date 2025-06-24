export default function withTimeout(fn, ms) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Function timed out')), ms)
    );
    return Promise.race([fn(), timeout]);
}
