import os from 'os';

import { env } from '@/config/env';

export interface SystemHealth {
    cpuUsage: number[];
    totalMemory: string;
    freeMemory: string;
}

export interface ApplicationHealth {
    environment: string;
    uptime: string;
    memoryUsage: { heapTotal: string; heapUsed: string };
}

export default {
    getSystemHealth: (): SystemHealth => {
        return {
            cpuUsage: os.loadavg(),
            totalMemory: `${(os.totalmem() / 1024 / 1024).toFixed(2)} MB`,
            freeMemory: `${(os.freemem() / 1024 / 1024).toFixed(2)} MB`,
        };
    },

    getApplicationHealth: (): ApplicationHealth => {
        return {
            environment: env.app.NODE_ENV,
            uptime: `${process.uptime().toFixed(2)} Second`,
            memoryUsage: {
                heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
            },
        };
    },
};
