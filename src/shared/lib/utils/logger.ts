import winston, { type Logger } from 'winston';
import path from 'path';
import moment from 'moment';
import { stripVTControlCharacters } from 'util';
import chalk from 'chalk';

const { combine, printf, splat, simple, errors } = winston.format;

const getTime = (file: boolean = false) => {
    return moment().format(file
        ? 'YYYY-MM-DD-HH-mm-ss'
        : 'YYYY-MM-DD HH:mm:ss'
    );
}

const jsonParser = (json: Record<any, any>, colorAndIndent: boolean = true) => {
    // convert to string with color, indented,
    // for color of value
    // boolean false = red
    // null/undefined = gray
    // string type = green
    // else: yellow
    
    const colorizeValue = (value: any): string => {
        if (value === null || value === undefined) {
            return chalk.gray(String(value));
        }
        if (typeof value === 'boolean') {
            return value === false ? chalk.red(String(value)) : chalk.yellow(String(value));
        }
        if (typeof value === 'string') {
            return chalk.green(`"${value}"`);
        }
        // Numbers and other types
        return chalk.yellow(String(value));
    };
    
    const formatObject = (obj: any, colorAndIndent: boolean = true, level: number = 0): string => {
        const indentStr = colorAndIndent ? '    '.repeat(level) : '';
        const nextIndentStr = colorAndIndent ? '    '.repeat(level + 1) : '';
        const newline = colorAndIndent ? '\n' : '';
        const space = colorAndIndent ? ' ' : '';
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            const items = obj.map(item => 
                typeof item === 'object' && item !== null
                    ? `${nextIndentStr}${formatObject(item, colorAndIndent, level + 1)}`
                    : `${nextIndentStr}${!colorAndIndent ? item : colorizeValue(item)}`
            );
            return `[${newline}${items.join(`,${newline}`)}${newline}${indentStr}]`;
        }
        
        if (typeof obj === 'object' && obj !== null) {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '{}';
            
            const items = keys.map(key => {
                const value = obj[key];
                let coloredValue;
                
                if (typeof value === 'object' && value !== null) {
                    if (Object.keys(value).length === 0 && value.constructor !== Object) {
                        // For objects with no enumerable properties but with a specific constructor
                        coloredValue = chalk.cyan(`[${value.constructor.name}]`);
                    } else {
                        coloredValue = formatObject(value, colorAndIndent, level + 1);
                    }
                } else {
                    coloredValue = !colorAndIndent ? value : colorizeValue(value);
                }
                
                return `${nextIndentStr}"${key}":${space}${coloredValue}`;
            });
            
            return `{${newline}${items.join(`,${newline}`)}${newline}${indentStr}}`;
        }
        
        return !colorAndIndent ? obj : colorizeValue(obj);
    };
    
    return formatObject(json, colorAndIndent);
};

const stackParser = (stack: string, color: boolean = true) => {
    if (!color) return stack;
    
    return stack
        .split('\n')
        .map((line: string, index: number) => {
            if (index === 0) {
                // First line is the error message
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const errorType = line.substring(0, colonIndex);
                    const errorMessage = line.substring(colonIndex + 1).trim();
                    return `${chalk.redBright(errorType)}: ${chalk.bold(errorMessage)}`;
                }
                return line;
            } else {
                // Stack trace lines - colorize file paths and line numbers
                return line.replace(
                    /at .+ \((.+):(\d+):(\d+)\)/,
                    (match, filePath, lineNum, colNum) => {
                        return match.replace(
                            `${filePath}:${lineNum}:${colNum}`,
                            `${chalk.cyan(filePath)}:${chalk.yellowBright(lineNum)}:${chalk.yellow(colNum)}`
                        );
                    }
                );
            }
        })
        .join('\n');
}

const formatLog = (color: boolean = true) => printf(info => {
    //console.log(info, '\n\n\n\n\n');
    const level = stripVTControlCharacters(info.level);
    let message = info.message;

    if (info.stack) {
        const colorizedStack = stackParser(String(info.stack), color);
        message = `${message}\n\n${colorizedStack}\n`;
    }
    
    // Handle other objects
    if (info[Symbol.for('splat')] && Array.isArray(info[Symbol.for('splat')])) {
        const args = info[Symbol.for('splat')] as any[];
        const formattedArgs = args.map((arg: any) => {

            if (arg instanceof Error) {
                return;
            }

            try {
                return typeof arg === 'object' ? jsonParser(arg, color) : String(arg);
            } catch (err) {
                return String(arg);
            }
        }).filter(Boolean); // Filter out undefined values
        
        if (formattedArgs.length > 0) {
            message = `${message}\n${formattedArgs.join('\n')}\n`;
        }
    }

    const levelColor = level === 'error' ? chalk.redBright : level === 'warn' ? chalk.yellowBright : level === 'info' ? chalk.blueBright : chalk.whiteBright;
    const text = `[${chalk.grey(getTime())}] [${levelColor.bold(level.toUpperCase())}]: ${message}`;
    if (!color) return stripVTControlCharacters(text);
    return text;
});

let logger: Logger;
type InitLogger = 'normal' | 'discord' | 'telegram';
export const createLogger = (name: InitLogger = 'normal') => {

    // Check if logger is already initialized
    if (logger) return logger;

    const filename = `${getTime(true)}${name === 'normal' ? '' : `-${name}`}.log`;

    // Winston instance with proper configuration
    logger = winston.createLogger({
        level: 'info',
        format: combine(
            errors({ stack: true }), // Enable error stack traces
            splat(),
            simple(),
        ),
        transports: [
            new winston.transports.Console({
                format: formatLog(true),
                level: process.env.DEBUG === 'true' ? 'debug' : 'info',
            }),
            new winston.transports.File({
                level: process.env.DEBUG === 'true' ? 'debug' : 'info',
                filename,
                dirname: path.join(process.cwd(), 'logs'),
                lazy: true,
                format: formatLog(false)
            }),
        ],
    });

    return logger;
}

export default createLogger;