/**
 * ไฟล์ Config ตัวอย่าง
 * คัดลอกไฟล์นี้เป็น config.local.ts แล้วปรับแต่งตามต้องการ
 */

export interface TestConfig {
  // URL ที่ต้องการทดสอบ
  url: string;
  
  // ที่อยู่สำหรับเก็บผลลัพธ์
  outputDir: string;
  screenshotsDir: string;
  
  // อุปกรณ์ที่ต้องการทดสอบ
  devices: Array<{
    name: string;
    width: number;
    height: number;
  }>;
  
  // Timeouts
  timeouts: {
    navigation: number;
    default: number;
  };
  
  // Browser settings
  browser: {
    headless: boolean;
    slowMo?: number; // ชะลอการทำงานเพื่อดูการทำงาน (ms)
  };
  
  // ตัวเลือกการทดสอบ
  tests: {
    performance: boolean;
    visualDesign: boolean;
    navigation: boolean;
    readability: boolean;
    forms: boolean;
    interactive: boolean;
    responsive: boolean;
    accessibility: boolean;
    errorHandling: boolean;
  };
  
  // Thresholds สำหรับ pass/fail
  thresholds: {
    overallScore: number;      // คะแนนรวมขั้นต่ำ (0-100)
    loadTime: number;          // เวลาโหลดสูงสุด (ms)
    lcp: number;               // LCP สูงสุด (ms)
    accessibility: {
      maxCritical: number;     // จำนวน critical issues สูงสุด
      maxSerious: number;      // จำนวน serious issues สูงสุด
    };
  };
  
  // การแจ้งเตือน
  notifications: {
    enabled: boolean;
    slack?: {
      webhookUrl: string;
    };
    email?: {
      from: string;
      to: string[];
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
  };
}

// ==============================
// Config ตัวอย่างสำหรับ Development
// ==============================

export const developmentConfig: TestConfig = {
  url: 'http://localhost:3000',
  outputDir: './outputs/ux-report',
  screenshotsDir: './outputs/ux-report/screenshots',
  
  devices: [
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Mobile', width: 375, height: 667 },
  ],
  
  timeouts: {
    navigation: 10000,
    default: 5000,
  },
  
  browser: {
    headless: false,  // แสดงเบราว์เซอร์เพื่อดูการทำงาน
    slowMo: 100,      // ชะลอเพื่อดูได้ชัดเจน
  },
  
  tests: {
    performance: true,
    visualDesign: true,
    navigation: true,
    readability: true,
    forms: true,
    interactive: true,
    responsive: true,
    accessibility: true,
    errorHandling: true,
  },
  
  thresholds: {
    overallScore: 60,
    loadTime: 5000,
    lcp: 4000,
    accessibility: {
      maxCritical: 5,
      maxSerious: 10,
    },
  },
  
  notifications: {
    enabled: false,
  },
};

// ==============================
// Config ตัวอย่างสำหรับ Production
// ==============================

export const productionConfig: TestConfig = {
  url: 'https://jigsawaiteam.com',
  outputDir: './outputs/ux-report',
  screenshotsDir: './outputs/ux-report/screenshots',
  
  devices: [
    { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
    { name: 'Desktop 1366x768', width: 1366, height: 768 },
    { name: 'Tablet iPad', width: 768, height: 1024 },
    { name: 'Mobile iPhone 12', width: 390, height: 844 },
    { name: 'Mobile Samsung S21', width: 360, height: 800 },
  ],
  
  timeouts: {
    navigation: 30000,
    default: 10000,
  },
  
  browser: {
    headless: true,
  },
  
  tests: {
    performance: true,
    visualDesign: true,
    navigation: true,
    readability: true,
    forms: true,
    interactive: true,
    responsive: true,
    accessibility: true,
    errorHandling: true,
  },
  
  thresholds: {
    overallScore: 80,
    loadTime: 3000,
    lcp: 2500,
    accessibility: {
      maxCritical: 0,
      maxSerious: 2,
    },
  },
  
  notifications: {
    enabled: true,
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    },
  },
};

// ==============================
// Config ตัวอย่างสำหรับ Staging
// ==============================

export const stagingConfig: TestConfig = {
  url: 'https://staging.jigsawaiteam.com',
  outputDir: './outputs/ux-report',
  screenshotsDir: './outputs/ux-report/screenshots',
  
  devices: [
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ],
  
  timeouts: {
    navigation: 20000,
    default: 10000,
  },
  
  browser: {
    headless: true,
  },
  
  tests: {
    performance: true,
    visualDesign: true,
    navigation: true,
    readability: true,
    forms: true,
    interactive: true,
    responsive: true,
    accessibility: true,
    errorHandling: true,
  },
  
  thresholds: {
    overallScore: 70,
    loadTime: 4000,
    lcp: 3000,
    accessibility: {
      maxCritical: 2,
      maxSerious: 5,
    },
  },
  
  notifications: {
    enabled: true,
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    },
  },
};

// ==============================
// Config ตัวอย่างแบบ Quick Test
// ==============================

export const quickTestConfig: TestConfig = {
  url: 'https://jigsawaiteam.com',
  outputDir: './outputs/ux-report',
  screenshotsDir: './outputs/ux-report/screenshots',
  
  devices: [
    { name: 'Desktop', width: 1920, height: 1080 },
  ],
  
  timeouts: {
    navigation: 15000,
    default: 5000,
  },
  
  browser: {
    headless: true,
  },
  
  tests: {
    performance: true,
    visualDesign: true,
    navigation: true,
    readability: false,
    forms: false,
    interactive: false,
    responsive: false,
    accessibility: true,
    errorHandling: false,
  },
  
  thresholds: {
    overallScore: 60,
    loadTime: 5000,
    lcp: 4000,
    accessibility: {
      maxCritical: 5,
      maxSerious: 10,
    },
  },
  
  notifications: {
    enabled: false,
  },
};

// ==============================
// Config ตัวอย่างสำหรับ CI/CD
// ==============================

export const cicdConfig: TestConfig = {
  url: process.env.TEST_URL || 'https://jigsawaiteam.com',
  outputDir: './outputs/ux-report',
  screenshotsDir: './outputs/ux-report/screenshots',
  
  devices: [
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Mobile', width: 375, height: 667 },
  ],
  
  timeouts: {
    navigation: 30000,
    default: 10000,
  },
  
  browser: {
    headless: true,
  },
  
  tests: {
    performance: true,
    visualDesign: true,
    navigation: true,
    readability: true,
    forms: true,
    interactive: true,
    responsive: true,
    accessibility: true,
    errorHandling: true,
  },
  
  thresholds: {
    overallScore: parseInt(process.env.MIN_SCORE || '70'),
    loadTime: parseInt(process.env.MAX_LOAD_TIME || '3000'),
    lcp: parseInt(process.env.MAX_LCP || '2500'),
    accessibility: {
      maxCritical: parseInt(process.env.MAX_CRITICAL_A11Y || '0'),
      maxSerious: parseInt(process.env.MAX_SERIOUS_A11Y || '2'),
    },
  },
  
  notifications: {
    enabled: process.env.ENABLE_NOTIFICATIONS === 'true',
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    },
  },
};

// ==============================
// Helper function เพื่อโหลด config
// ==============================

export function getConfig(environment: string = 'production'): TestConfig {
  const configs: Record<string, TestConfig> = {
    development: developmentConfig,
    staging: stagingConfig,
    production: productionConfig,
    quick: quickTestConfig,
    cicd: cicdConfig,
  };
  
  return configs[environment] || productionConfig;
}

// ==============================
// วิธีใช้งาน
// ==============================

/*
// ใน code ของคุณ:

import { getConfig } from './config.local';

const config = getConfig(process.env.NODE_ENV || 'production');

const tester = new UXUITester(config);
await tester.runAllTests();
*/
