const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Get log file path for today
function getLogFilePath(prefix = 'app') {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logsDir, `${prefix}-${today}.log`);
}

// Format log message
function formatLogMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
}

// Write to both console and file
function writeLog(level, message, data = null, logFile = null) {
  const formatted = formatLogMessage(level, message, data);
  
  // Always log to console
  if (level === 'ERROR') {
    console.error(formatted.trim());
  } else if (level === 'WARN') {
    console.warn(formatted.trim());
  } else {
    console.log(formatted.trim());
  }
  
  // Write to file if logFile is provided
  if (logFile) {
    try {
      fs.appendFileSync(logFile, formatted, 'utf8');
    } catch (err) {
      console.error(`Failed to write to log file: ${err.message}`);
    }
  }
}

// Logger class
class Logger {
  constructor(prefix = 'app') {
    this.prefix = prefix;
    this.logFile = getLogFilePath(prefix);
  }
  
  log(message, data = null) {
    writeLog('INFO', message, data, this.logFile);
  }
  
  info(message, data = null) {
    writeLog('INFO', message, data, this.logFile);
  }
  
  warn(message, data = null) {
    writeLog('WARN', message, data, this.logFile);
  }
  
  error(message, data = null) {
    writeLog('ERROR', message, data, this.logFile);
  }
  
  debug(message, data = null) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      writeLog('DEBUG', message, data, this.logFile);
    }
  }
}

// Create default logger
const defaultLogger = new Logger('app');

// Create specialized loggers
const syncLogger = new Logger('sync');
const directAdminLogger = new Logger('directadmin');

module.exports = {
  Logger,
  defaultLogger,
  syncLogger,
  directAdminLogger,
  getLogFilePath,
};





