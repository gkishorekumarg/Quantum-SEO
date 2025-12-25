
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'process';

export default defineConfig(({ mode }) => {
  // Load environment variables from the system/environment (Vercel provides these during build)
  // Using an empty string as the third argument allows loading variables not prefixed with VITE_
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Replace process.env.API_KEY in the source code with the string value from the environment.
      // This is necessary because Vite does not provide process.env to the browser by default.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      // Provide a minimal process.env shim to prevent "process is not defined" errors in other libraries
      'process.env': {
        NODE_ENV: JSON.stringify(mode),
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 3000,
    }
  };
});
