// Web Serial API implementation to connect with real ESP32 over USB

export interface SerialPortState {
  isSupported: boolean;
  isConnected: boolean;
  portName: string;
}

let activePort: unknown = null;
let activeReader: ReadableStreamDefaultReader<string> | null = null;
let activeWriter: WritableStreamDefaultWriter<string> | null = null;
let keepReading = false;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function requestAndConnectSerial(
  baudRate: number = 115200,
  onData: (line: string) => void,
  onDisconnect: () => void
): Promise<{ success: boolean; portName: string; error?: string }> {
  if (!isWebSerialSupported()) {
    return { success: false, portName: '', error: 'Navegador não suporta Web Serial API. Use Chrome ou Edge.' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial;
    const port = await serial.requestPort();
    await port.open({ baudRate });

    activePort = port;
    keepReading = true;

    // Set up text decoder stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textDecoder = new (window as any).TextDecoderStream();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readableStreamClosed = (port as any).readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    activeReader = reader;

    // Set up text encoder stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textEncoder = new (window as any).TextEncoderStream();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textEncoder.readable.pipeTo((port as any).writable);
    activeWriter = textEncoder.writable.getWriter();

    // Background reader loop
    (async () => {
      let buffer = '';
      try {
        while (keepReading) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                onData(trimmed);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Serial read loop ended:', err);
      } finally {
        onDisconnect();
      }
    })();

    // Port info info
    const info = port.getInfo ? port.getInfo() : {};
    const portName = info.usbVendorId ? `USB (VID: ${info.usbVendorId.toString(16)})` : 'ESP32 Device';

    return { success: true, portName };
  } catch (err) {
    return { success: false, portName: '', error: err instanceof Error ? err.message : 'Falha na conexão serial' };
  }
}

export async function sendSerialCommand(cmd: string): Promise<boolean> {
  if (!activeWriter) return false;
  try {
    await activeWriter.write(cmd.endsWith('\n') ? cmd : `${cmd}\n`);
    return true;
  } catch (err) {
    console.error('Failed to send serial data:', err);
    return false;
  }
}

export async function disconnectSerial(): Promise<void> {
  keepReading = false;
  try {
    if (activeReader) {
      await activeReader.cancel();
      activeReader = null;
    }
    if (activeWriter) {
      await activeWriter.close();
      activeWriter = null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (activePort && (activePort as any).close) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (activePort as any).close();
      activePort = null;
    }
  } catch (err) {
    console.warn('Error during disconnect:', err);
  }
}
