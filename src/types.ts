export type RobotState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'RESPONDING'
  | 'ERROR'
  | 'LOCKDOWN';

export type ExpressionCode =
  | 'DEFAULT'
  | 'NEUTRAL'
  | 'HAPPY'
  | 'CONFUSED'
  | 'LAUGH'
  | 'TIRED'
  | 'SAD'
  | 'ANGRY'
  | 'ERROR'
  | 'BLINK'
  | 'THINKING'
  | 'TALKING';

export type CardinalPosition = 'DEFAULT' | 'N' | 'S' | 'E' | 'W';

export type SemaphoreColor = 'OFF' | 'RED' | 'YELLOW' | 'GREEN';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'tx' | 'rx' | 'sys' | 'ai' | 'err';
  text: string;
}

export interface RobotTelemetry {
  state: RobotState;
  eyes: ExpressionCode;
  wifi: string;
  ip: string;
  batteryLevel: number; // %
  servoLeftSpeed: number; // us (1150 - 1850)
  servoRightSpeed: number; // us
  ledColor: SemaphoreColor;
  buzzerActive: boolean;
  soundTriggered: boolean;
  buttonPressed: boolean;
  lastCommand: string;
  timestamp: number;
}
