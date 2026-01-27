# CI/CD Integration Examples

## GitHub Actions

สร้างไฟล์ `.github/workflows/ux-ui-test.yml`:

\`\`\`yaml
name: UX/UI Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    # Run every Monday at 9 AM
    - cron: '0 9 * * 1'

jobs:
  ux-ui-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci
        npx playwright install --with-deps
    
    - name: Run UX/UI tests
      run: npm test
    
    - name: Upload test report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: ux-ui-report
        path: ./outputs/ux-report/
        retention-days: 30
    
    - name: Comment PR with results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const report = JSON.parse(fs.readFileSync('./outputs/ux-report/ux-report.json', 'utf8'));
          
          const body = \`## 📊 UX/UI Test Results
          
          **Overall Score:** \${report.overallScore}/100
          **Status:** \${report.overallScore >= 80 ? '✅ PASS' : '⚠️ NEEDS IMPROVEMENT'}
          
          ### Summary
          - Total Tests: \${report.results.length}
          - ✅ Passed: \${report.results.filter(r => r.status === 'pass').length}
          - ⚠️ Warnings: \${report.results.filter(r => r.status === 'warning').length}
          - ❌ Failed: \${report.results.filter(r => r.status === 'fail').length}
          
          ### Performance Metrics
          - Load Time: \${(report.performance.loadTime / 1000).toFixed(2)}s
          - LCP: \${Math.round(report.performance.largestContentfulPaint)}ms
          
          [View Full Report](https://github.com/\${context.repo.owner}/\${context.repo.repo}/actions/runs/\${context.runId})
          \`;
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: body
          });
    
    - name: Fail if score is too low
      run: |
        SCORE=$(node -e "console.log(require('./outputs/ux-report/ux-report.json').overallScore)")
        if [ $SCORE -lt 70 ]; then
          echo "❌ UX/UI score ($SCORE) is below threshold (70)"
          exit 1
        fi
\`\`\`

---

## GitLab CI

สร้างไฟล์ `.gitlab-ci.yml`:

\`\`\`yaml
stages:
  - test
  - report

ux-ui-test:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  
  before_script:
    - npm ci
  
  script:
    - npm test
  
  artifacts:
    when: always
    paths:
      - ./outputs/ux-report/
    expire_in: 1 month
  
  only:
    - main
    - develop
    - merge_requests

report-results:
  stage: report
  image: node:18
  dependencies:
    - ux-ui-test
  
  script:
    - |
      echo "📊 UX/UI Test Results"
      node -e "
        const report = require('./outputs/ux-report/ux-report.json');
        console.log('Overall Score:', report.overallScore + '/100');
        console.log('Passed:', report.results.filter(r => r.status === 'pass').length);
        console.log('Failed:', report.results.filter(r => r.status === 'fail').length);
      "
  
  only:
    - main
    - develop
\`\`\`

---

## Jenkins Pipeline

สร้างไฟล์ \`Jenkinsfile\`:

\`\`\`groovy
pipeline {
  agent any
  
  stages {
    stage('Setup') {
      steps {
        nodejs(nodeJSInstallationName: 'Node 18') {
          sh 'npm ci'
          sh 'npx playwright install --with-deps'
        }
      }
    }
    
    stage('UX/UI Test') {
      steps {
        nodejs(nodeJSInstallationName: 'Node 18') {
          sh 'npm test'
        }
      }
    }
    
    stage('Publish Report') {
      steps {
        publishHTML([
          allowMissing: false,
          alwaysLinkToLastBuild: true,
          keepAll: true,
          reportDir: './outputs/ux-report',
          reportFiles: 'ux-report.html',
          reportName: 'UX/UI Test Report'
        ])
      }
    }
    
    stage('Check Quality Gate') {
      steps {
        script {
          def report = readJSON file: './outputs/ux-report/ux-report.json'
          def score = report.overallScore
          
          echo "UX/UI Score: ${score}/100"
          
          if (score < 70) {
            error("UX/UI score (${score}) is below threshold (70)")
          }
        }
      }
    }
  }
  
  post {
    always {
      archiveArtifacts artifacts: './outputs/ux-report/**/*', allowEmptyArchive: false
    }
    
    success {
      echo '✅ UX/UI tests passed!'
    }
    
    failure {
      echo '❌ UX/UI tests failed!'
      
      emailext(
        subject: "UX/UI Test Failed - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
        body: "Check console output at ${env.BUILD_URL}",
        to: 'team@example.com'
      )
    }
  }
}
\`\`\`

---

## CircleCI

สร้างไฟล์ `.circleci/config.yml`:

\`\`\`yaml
version: 2.1

orbs:
  node: circleci/node@5.0.0

jobs:
  ux-ui-test:
    docker:
      - image: mcr.microsoft.com/playwright:v1.40.0-focal
    
    steps:
      - checkout
      
      - node/install-packages:
          pkg-manager: npm
      
      - run:
          name: Install Playwright browsers
          command: npx playwright install
      
      - run:
          name: Run UX/UI tests
          command: npm test
      
      - store_artifacts:
          path: ./outputs/ux-report
          destination: ux-ui-report
      
      - run:
          name: Check score threshold
          command: |
            SCORE=$(node -e "console.log(require('./outputs/ux-report/ux-report.json').overallScore)")
            echo "Score: $SCORE"
            if [ $SCORE -lt 70 ]; then
              echo "Score is below threshold"
              exit 1
            fi

workflows:
  version: 2
  test-and-report:
    jobs:
      - ux-ui-test
\`\`\`

---

## Azure DevOps

สร้างไฟล์ `azure-pipelines.yml`:

\`\`\`yaml
trigger:
  - main
  - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18.x'
  displayName: 'Install Node.js'

- script: |
    npm ci
    npx playwright install --with-deps
  displayName: 'Install dependencies'

- script: npm test
  displayName: 'Run UX/UI tests'

- task: PublishBuildArtifacts@1
  inputs:
    pathToPublish: './outputs/ux-report'
    artifactName: 'ux-ui-report'
  condition: always()

- task: PublishTestResults@2
  inputs:
    testResultsFormat: 'JUnit'
    testResultsFiles: './outputs/ux-report/ux-report.json'
  condition: always()

- script: |
    SCORE=$(node -e "console.log(require('./outputs/ux-report/ux-report.json').overallScore)")
    echo "##vso[task.setvariable variable=uxScore]$SCORE"
    if [ $SCORE -lt 70 ]; then
      echo "##vso[task.logissue type=error]UX/UI score ($SCORE) is below threshold (70)"
      exit 1
    fi
  displayName: 'Validate score'
\`\`\`

---

## Docker

สร้างไฟล์ `Dockerfile`:

\`\`\`dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Create output directory
RUN mkdir -p ./outputs/ux-report

CMD ["npm", "test"]
\`\`\`

สร้างไฟล์ `docker-compose.yml`:

\`\`\`yaml
version: '3.8'

services:
  ux-ui-tester:
    build: .
    volumes:
      - ./outputs/ux-report:/app/outputs/ux-report
    environment:
      - NODE_ENV=production
\`\`\`

รันด้วย:
\`\`\`bash
docker-compose up
\`\`\`

---

## Scheduled Testing (Cron Job)

สร้างสคริปต์ `schedule-test.sh`:

\`\`\`bash
#!/bin/bash

# Daily UX/UI testing script
# Add to crontab: 0 9 * * * /path/to/schedule-test.sh

cd /path/to/project

# Run test
npm test

# Check score
SCORE=$(node -e "console.log(require('./outputs/ux-report/ux-report.json').overallScore)")

# Send notification if score drops
if [ $SCORE -lt 70 ]; then
  # Send email, Slack notification, etc.
  echo "UX/UI score dropped to $SCORE" | mail -s "UX/UI Alert" team@example.com
fi

# Archive report
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p ./reports/archive
cp ./outputs/ux-report/ux-report.html "./reports/archive/report_$TIMESTAMP.html"
\`\`\`

เพิ่มใน crontab:
\`\`\`bash
# Run every day at 9 AM
0 9 * * * /path/to/schedule-test.sh

# Run every Monday at 9 AM
0 9 * * 1 /path/to/schedule-test.sh
\`\`\`

---

## Slack Notifications

เพิ่ม script สำหรับส่ง notification ไป Slack:

\`\`\`javascript
// slack-notify.js
const https = require('https');
const fs = require('fs');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const report = JSON.parse(fs.readFileSync('./outputs/ux-report/ux-report.json'));

const color = report.overallScore >= 80 ? 'good' : report.overallScore >= 60 ? 'warning' : 'danger';

const payload = {
  attachments: [{
    color: color,
    title: '📊 UX/UI Test Report',
    fields: [
      { title: 'Overall Score', value: \`\${report.overallScore}/100\`, short: true },
      { title: 'Status', value: report.overallScore >= 80 ? '✅ Pass' : '⚠️ Needs Work', short: true },
      { title: 'Passed', value: report.results.filter(r => r.status === 'pass').length, short: true },
      { title: 'Failed', value: report.results.filter(r => r.status === 'fail').length, short: true }
    ],
    footer: 'UX/UI Testing Tool',
    ts: Math.floor(Date.now() / 1000)
  }]
};

const options = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const req = https.request(SLACK_WEBHOOK_URL, options, (res) => {
  console.log('Notification sent to Slack');
});

req.write(JSON.stringify(payload));
req.end();
\`\`\`

ใช้งาน:
\`\`\`bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
node slack-notify.js
\`\`\`
