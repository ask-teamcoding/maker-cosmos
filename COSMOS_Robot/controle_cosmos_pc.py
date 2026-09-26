#!/usr/bin/env python3
"""
Controle Remoto COSMOS - Aplicação Windows para controlar o robô ESP32 via Serial
Autor: Engenheiro de Firmware Sênior
Data: 2026-09-25
"""

import os
import subprocess
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import serial
import serial.tools.list_ports
import json
import threading
import time
import platform
import sys
import queue
import math

try:
    import requests
except Exception:
    requests = None

try:
    import pyttsx3
except Exception:
    pyttsx3 = None

try:
    import speech_recognition as sr
except Exception:
    sr = None

try:
    from roboeyes import EyeRenderer
    HAS_ROBOEYES = True
except Exception:
    HAS_ROBOEYES = False
    EyeRenderer = None

# Tentar importar PIL para imagens melhores, cair back para tkinter
try:
    from PIL import Image, ImageTk, ImageDraw
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("PIL não instalado. Instale com: pip install Pillow")

# ============================================================================
# CONFIGURAÇÕES DO SISTEMA
# ============================================================================

# Portas COM comuns no Windows - atualize conforme necessário
PORTAS_COM_PADRAO = [
    'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'COM10', 'COM11', 'COM12'
]

# Configurações de comunicação serial (deve corresponder ao firmware ESP32)
SERIAL_CONFIG = {
    'baudrate': 115200,
    'bytesize': 8,
    'parity': 'N',
    'stopbits': 1,
    'timeout': 1.0
}

# Comandos enviados ao ESP32 (consulte o firmware para a sintaxe exata)
COMMANDS = {
    'LISTEN': 'LISTEN\n',        # Acionar escuta (botão/som)
    'IDLE': 'IDLE\n',            # Voltar ao estado neutro
    'STATUS': 'STATUS\n',        # Solicitar status atual
    'RESET': 'RESET\n',          # Reiniciar o dispositivo
    'EYES_NEUTRAL': 'EYES_NEUTRAL\n',
    'EYES_HAPPY': 'EYES_HAPPY\n',
    'EYES_THINKING': 'EYES_THINKING\n',
    'EYES_TALKING': 'EYES_TALKING\n',
    'EYES_SAD': 'EYES_SAD\n',
    'EYES_ERROR': 'EYES_ERROR\n',
    'MOTORS_FORWARD': 'FORWARD\n',
    'MOTORS_BACK': 'BACK\n',
    'MOTORS_STOP': 'STOP\n',
    'MOTORS_LEFT': 'LEFT\n',
    'MOTORS_RIGHT': 'RIGHT\n',
    'BUZZER_ON': 'BUZZER_ON\n',
    'BUZZER_OFF': 'BUZZER_OFF\n',
    'LED_GREEN': 'LED_GREEN\n',
    'LED_YELLOW': 'LED_YELLOW\n',
    'LED_RED': 'LED_RED\n',
    'GET_PROMPT': 'GET_PROMPT\n'
}

# ============================================================================
# CONFIGURAÇÕES DE IA E VOZ
# ============================================================================

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"

class VoiceAssistant:
    def __init__(self):
        self.engine = None
        self.recognizer = None
        self.microphone = None
        self._tts_ready = False

        if pyttsx3 is not None:
            try:
                self.engine = pyttsx3.init()
                self.engine.setProperty('rate', 170)
                self.engine.setProperty('volume', 1.0)
                self._tts_ready = True
            except Exception:
                self.engine = None

        if sr is not None:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
            except Exception:
                self.recognizer = None
                self.microphone = None

    def say(self, text):
        if not text or not str(text).strip():
            return False
        if self.engine is not None:
            try:
                self.engine.say(str(text))
                self.engine.runAndWait()
                return True
            except Exception:
                pass
        try:
            if platform.system() == 'Windows':
                import win32com.client
                speaker = win32com.client.Dispatch('SAPI.SpVoice')
                speaker.Speak(str(text))
                return True
        except Exception:
            pass
        try:
            if os.system('where powershell >nul 2>nul') == 0:
                text_safe = str(text).replace('"', '\\"')
                subprocess.run(['powershell', '-NoProfile', '-Command', f'[System.Speech.Synthesis.SpeechSynthesizer, System.Speech, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35]::new().Speak("{text_safe}")'], shell=True, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True
        except Exception:
            pass
        return False

    def listen_once(self, timeout=8, phrase_time_limit=8):
        if self.recognizer is None or self.microphone is None:
            return ""
        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_time_limit)
            try:
                return self.recognizer.recognize_google(audio, language='pt-BR')
            except Exception:
                try:
                    return self.recognizer.recognize_google(audio, language='en-US')
                except Exception:
                    return ""
        except Exception:
            return ""

# ============================================================================
# FALLBACK LOCAL DO ROBEYES
# ============================================================================

class RoboEyesFallback:
    """Fallback local para manter a aparência do RoboEyes mesmo sem biblioteca externa."""

    def __init__(self, canvas):
        self.canvas = canvas
        self.estado = 'NEUTRAL'

    def draw(self, estado='NEUTRAL'):
        self.estado = str(estado or 'NEUTRAL').upper().strip()
        self.canvas.delete('all')

        w = self.canvas.winfo_width() or 320
        h = self.canvas.winfo_height() or 240
        cx = w / 2
        cy = h / 2

        self.canvas.create_rectangle(0, 0, w, h, fill='#020817', outline='')
        self.canvas.create_rectangle(14, 14, w - 14, h - 14, outline='#1f2937', width=2, fill='#050b16')
        self.canvas.create_line(24, 24, w - 24, 24, fill='#0ea5e9', width=2)
        self.canvas.create_line(24, h - 24, w - 24, h - 24, fill='#0ea5e9', width=2)

        eye_r = 46
        pupil_r = 16
        offset_map = {'NEUTRAL': 0, 'HAPPY': 7, 'THINKING': 12, 'TALKING': 18, 'SAD': -7, 'ERROR': 0, 'BLINK': 0, 'ANGRY': 0}
        offset = offset_map.get(self.estado, 0)

        for sign in (-1, 1):
            x = cx + sign * 82
            y = cy
            self.canvas.create_oval(x - eye_r, y - eye_r, x + eye_r, y + eye_r, fill='#fafcff', outline='#67e8f9', width=3)
            self.canvas.create_oval(x - eye_r + 8, y - eye_r + 8, x + eye_r - 8, y + eye_r - 8, fill='#e2e8f0', outline='')
            px = x + offset
            py = y + (8 if self.estado == 'HAPPY' else 0) + (4 if self.estado == 'THINKING' else 0)
            self.canvas.create_oval(px - pupil_r, py - pupil_r, px + pupil_r, py + pupil_r, fill='#1d4ed8', outline='#0f172a', width=2)
            self.canvas.create_oval(px - 6, py - 6, px + 2, py + 2, fill='white', outline='')

        if self.estado == 'HAPPY':
            self.canvas.create_arc(cx - 74, cy + 42, cx + 74, cy + 106, start=200, extent=140, style='arc', outline='#34d399', width=4)
        elif self.estado == 'SAD':
            self.canvas.create_arc(cx - 74, cy + 112, cx + 74, cy + 48, start=20, extent=140, style='arc', outline='#fbbf24', width=4)
        elif self.estado == 'THINKING':
            self.canvas.create_text(cx, cy + 86, text='?', fill='white', font=('Arial', 22, 'bold'))
        elif self.estado == 'TALKING':
            self.canvas.create_text(cx, cy + 88, text='...', fill='white', font=('Arial', 18, 'bold'))
        elif self.estado == 'ERROR':
            self.canvas.create_line(cx - 36, cy + 92, cx + 36, cy + 92, fill='#f87171', width=4)
            self.canvas.create_text(cx, cy + 120, text='ALERT', fill='#f87171', font=('Arial', 12, 'bold'))
        else:
            self.canvas.create_text(cx, cy + 90, text='COSMOS', fill='#e2e8f0', font=('Arial', 16, 'bold'))

        self.canvas.create_line(cx - 88, cy + 120, cx + 88, cy + 120, fill='#1e293b', width=2)
        self.canvas.create_text(cx, 30, text='ROBOEYES', fill='#7dd3fc', font=('Arial', 9, 'bold'))

# ============================================================================
# CLASSE PRINCIPAL - Aplicação de Controle
# ============================================================================

class ControleCOSMOS:
    def __init__(self, root):
        self.root = root
        self.root.title("COSMOS - Controle Remoto PC")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 800)
        
        # Configurar ícone se disponível
        try:
            self.root.iconbitmap(default="cosmos_icon.ico")
        except:
            pass
        
        # Variáveis de estado
        self.serial_conn = None
        self.is_connected = False
        self.data_queue = queue.Queue()
        self.running = False
        
        # Última resposta da IA
        self.ai_response = "Aguardando conexão..."
        self.eye_renderer = None
        self.offline_mode = True
        self.voice = VoiceAssistant()
        self.ollama_available = self.check_ollama_available()
        self.quick_mode = "offline"
        
        # Montar interface
        self.criar_interface()
        
        # Tentar conectar automaticamente
        self.root.after(1000, self.tentar_conectar_auto)
    
    def criar_interface(self):
        """Cria a interface completa do usuário"""
        # Configurar estilo com fallback seguro para versões do Tkinter
        style = ttk.Style()
        try:
            temas = style.theme_names()
            if 'clam' in temas:
                style.theme_use('clam')
            elif temas:
                style.theme_use(temas[0])
        except Exception:
            pass
        
        # Frame principal dividido em áreas
        self.main_frame = ttk.Frame(self.root, padding=10)
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Área esquerda - Controles
        self.criar_area_controles()
        
        # Área central - Preview OLED
        self.criar_area_preview()
        
        # Área direita - Logs e status
        self.criar_area_logs()
        
        # Barra de status
        self.criar_barra_status()
    
    def criar_area_controles(self):
        """Cria a área de controles esquerdo"""
        frame_controles = ttk.LabelFrame(self.main_frame, text="Controles do Robô", padding=10)
        frame_controles.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, 5))
        frame_controles.config(width=400)
        
        # Frame de conexão
        frame_conexao = ttk.LabelFrame(frame_controles, text="Conexão Serial", padding=10)
        frame_conexao.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(frame_conexao, text="Porta COM:").pack(anchor=tk.W)
        self.combo_porta = ttk.Combobox(frame_conexao, values=PORTAS_COM_PADRAO, state="readonly", width=15)
        self.combo_porta.pack(fill=tk.X, pady=2)
        self.combo_porta.set('COM3')  # Default
        
        ttk.Label(frame_conexao, text="Baudrate:").pack(anchor=tk.W, pady=(10, 0))
        self.combo_baud = ttk.Combobox(frame_conexao, values=['9600', '115200', '57600', '38400'], state="readonly", width=15)
        self.combo_baud.set('115200')
        self.combo_baud.pack(fill=tk.X, pady=2)
        
        self.btn_conectar = ttk.Button(frame_conexao, text="Conectar", command=self.toggle_conexao)
        self.btn_conectar.pack(fill=tk.X, pady=5)
        
        btn_refresh = ttk.Button(frame_conexao, text="Atualizar Portas", command=self.atualizar_portas)
        btn_refresh.pack(fill=tk.X)
        
        # Frame de comandos rápidos
        frame_comandos = ttk.LabelFrame(frame_controles, text="Comandos Rápidos", padding=10)
        frame_comandos.pack(fill=tk.X, pady=(10, 0))
        
        # Botões de controle de movimento
        btn_frame = ttk.LabelFrame(frame_comandos, text="Movimento", padding=5)
        btn_frame.pack(fill=tk.X, pady=5)
        
        btn_forward = ttk.Button(btn_frame, text="↑ Frente", width=12, command=lambda: self.enviar_comando('MOTORS_FORWARD'))
        btn_forward.pack(pady=2)
        
        btn_left = ttk.Button(btn_frame, text="← Esquerda", width=12, command=lambda: self.enviar_comando('MOTORS_LEFT'))
        btn_left.pack(pady=2)
        
        btn_stop = ttk.Button(btn_frame, text="■ Parar", width=12, command=lambda: self.enviar_comando('MOTORS_STOP'))
        btn_stop.pack(pady=2, padx=(20, 0))
        
        btn_right = ttk.Button(btn_frame, text="Direita →", width=12, command=lambda: self.enviar_comando('MOTORS_RIGHT'))
        btn_right.pack(pady=2)
        
        btn_back = ttk.Button(btn_frame, text="↓ Trás", width=12, command=lambda: self.enviar_comando('MOTORS_BACK'))
        btn_back.pack(pady=2)
        
        # Botões de estado dos olhos
        frame_olhos = ttk.LabelFrame(frame_comandos, text="Expressão dos Olhos", padding=5)
        frame_olhos.pack(fill=tk.X, pady=5)
        
        btn_neutral = ttk.Button(frame_olhos, text="Neutro", width=10, command=lambda: self.enviar_comando('EYES_NEUTRAL'))
        btn_neutral.pack(side=tk.LEFT, padx=2)
        
        btn_happy = ttk.Button(frame_olhos, text="Feliz", width=10, command=lambda: self.enviar_comando('EYES_HAPPY'))
        btn_happy.pack(side=tk.LEFT, padx=2)
        
        btn_thinking = ttk.Button(frame_olhos, text="Pensando", width=10, command=lambda: self.enviar_comando('EYES_THINKING'))
        btn_thinking.pack(side=tk.LEFT, padx=2)
        
        btn_talking = ttk.Button(frame_olhos, text="Falando", width=10, command=lambda: self.enviar_comando('EYES_TALKING'))
        btn_talking.pack(side=tk.LEFT, padx=2)
        
        btn_sad = ttk.Button(frame_olhos, text="Triste", width=10, command=lambda: self.enviar_comando('EYES_SAD'))
        btn_sad.pack(side=tk.LEFT, padx=2)
        
        btn_error = ttk.Button(frame_olhos, text="Erro", width=10, command=lambda: self.enviar_comando('EYES_ERROR'))
        btn_error.pack(side=tk.LEFT, padx=2)
        
        # Controle de buzzer
        frame_buzzer = ttk.LabelFrame(frame_comandos, text="Buzzer", padding=5)
        frame_buzzer.pack(fill=tk.X, pady=5)
        
        btn_buzzer_on = ttk.Button(frame_buzzer, text="Ligar", width=10, command=lambda: self.enviar_comando('BUZZER_ON'))
        btn_buzzer_on.pack(side=tk.LEFT, padx=2)
        
        btn_buzzer_off = ttk.Button(frame_buzzer, text="Desligar", width=10, command=lambda: self.enviar_comando('BUZZER_OFF'))
        btn_buzzer_off.pack(side=tk.LEFT, padx=2)
        
        # Controle de LEDs
        frame_leds = ttk.LabelFrame(frame_comandos, text="Semáforo LED", padding=5)
        frame_leds.pack(fill=tk.X, pady=5)
        
        btn_led_green = ttk.Button(frame_leds, text="🟢 Verde", width=10, command=lambda: self.enviar_comando('LED_GREEN'))
        btn_led_green.pack(side=tk.LEFT, padx=2)
        
        btn_led_yellow = ttk.Button(frame_leds, text="🟡 Amarelo", width=10, command=lambda: self.enviar_comando('LED_YELLOW'))
        btn_led_yellow.pack(side=tk.LEFT, padx=2)
        
        btn_led_red = ttk.Button(frame_leds, text="🔴 Vermelho", width=10, command=lambda: self.enviar_comando('LED_RED'))
        btn_led_red.pack(side=tk.LEFT, padx=2)
        
        frame_modos = ttk.LabelFrame(frame_controles, text="Menu rápido 1-4", padding=10)
        frame_modos.pack(fill=tk.X, pady=(10, 0))

        self.quick_mode_var = tk.StringVar(value='offline')

        for idx, (label, mode, color) in enumerate([
            ('1. Offline', 'offline', 'lightgray'),
            ('2. IA', 'ia', 'skyblue'),
            ('3. Voz', 'voice', 'lightgreen'),
            ('4. Robô', 'robot', 'salmon')
        ], start=1):
            btn = ttk.Button(frame_modos, text=label, command=lambda m=mode: self.set_quick_mode(m))
            btn.pack(fill=tk.X, pady=2)

        frame_ia = ttk.LabelFrame(frame_controles, text="Conversa com IA (Groq / Ollama / Offline)", padding=10)
        frame_ia.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Label(frame_ia, text="Prompt:").pack(anchor=tk.W)
        self.entry_prompt = ttk.Entry(frame_ia, width=30)
        self.entry_prompt.pack(fill=tk.X, pady=2)
        self.entry_prompt.insert(0, "Diga um fato sobre robôs")
        
        btn_row = ttk.Frame(frame_ia)
        btn_row.pack(fill=tk.X, pady=5)
        btn_enviar_ia = ttk.Button(btn_row, text="Enviar para IA", command=self.enviar_para_ia)
        btn_enviar_ia.pack(side=tk.LEFT, expand=True, padx=(0, 5), fill=tk.X)
        btn_ouvir = ttk.Button(btn_row, text="Ouvir microfone", command=self.ouvir_microfone)
        btn_ouvir.pack(side=tk.LEFT, expand=True, fill=tk.X)

        btn_row2 = ttk.Frame(frame_ia)
        btn_row2.pack(fill=tk.X, pady=(0, 5))
        btn_falar = ttk.Button(btn_row2, text="Falar resposta", command=self.falar_resposta)
        btn_falar.pack(side=tk.LEFT, expand=True, padx=(0, 5), fill=tk.X)
        btn_status_ia = ttk.Button(btn_row2, text="Status IA", command=self.mostrar_status_ia)
        btn_status_ia.pack(side=tk.LEFT, expand=True, fill=tk.X)
        
        # Atalho Enter para enviar
        self.root.bind('<Return>', lambda e: self.enviar_para_ia() if self.entry_prompt.focus_get() == self.entry_prompt else None)
    
    def criar_area_preview(self):
        """Cria a área de preview do OLED com visual RoboEyes"""
        frame_preview = ttk.LabelFrame(self.main_frame, text="Preview RoboEyes - COSMOS", padding=10)
        frame_preview.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(5, 0))
        frame_preview.config(width=500)
        
        # Canvas para desenhar o rosto
        self.canvas_oled = tk.Canvas(frame_preview, width=320, height=240, bg='black', highlightthickness=2, highlightbackground='#1f2937')
        self.canvas_oled.pack(pady=10)

        if HAS_ROBOEYES and EyeRenderer is not None:
            try:
                self.eye_renderer = EyeRenderer(self.canvas_oled)
            except Exception:
                self.eye_renderer = RoboEyesFallback(self.canvas_oled)
        else:
            self.eye_renderer = RoboEyesFallback(self.canvas_oled)
        
        # Inicializar desenho do rosto
        self.desenhar_rosto_neutro()
        
        # Label de status
        self.label_status_preview = ttk.Label(frame_preview, text="Estado RoboEyes: Desconectado", font=('Arial', 10))
        self.label_status_preview.pack()
        
        # Botão de atualização manual
        btn_atualizar = ttk.Button(frame_preview, text="Atualizar Preview RoboEyes", command=self.atualizar_preview_manual)
        btn_atualizar.pack(pady=5)
    
    def criar_area_logs(self):
        """Cria a área de logs e informações"""
        frame_logs = ttk.LabelFrame(self.main_frame, text="Logs e Status do Sistema", padding=10)
        frame_logs.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))
        frame_logs.config(width=400)
        
        # Área de texto para logs
        self.text_logs = scrolledtext.ScrolledText(frame_logs, height=20, font=('Consolas', 9))
        self.text_logs.pack(fill=tk.BOTH, expand=True)
        self.text_logs.insert(tk.END, "Sistema iniciado...\n")
        
        # Frame de informações
        frame_info = ttk.LabelFrame(frame_logs, text="Informações", padding=5)
        frame_info.pack(fill=tk.X, pady=(10, 0))
        
        self.label_ip = ttk.Label(frame_info, text="IP ESP32: --.--.--.--")
        self.label_ip.pack(anchor=tk.W)
        
        self.label_estado = ttk.Label(frame_info, text="Estado: Aguardando conexão")
        self.label_estado.pack(anchor=tk.W, pady=2)
        
        self.label_prompt_atual = ttk.Label(frame_info, text="Prompt atual: Nenhum")
        self.label_prompt_atual.pack(anchor=tk.W, pady=2)
    
    def criar_barra_status(self):
        """Cria a barra de status inferior"""
        self.status_bar = ttk.Frame(self.root, relief=tk.SUNKEN, borderwidth=1)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=5)
        
        self.status_text = ttk.Label(self.status_bar, text="Pronto - Aguardando conexão serial", anchor=tk.W)
        self.status_text.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        self.label_porta_status = ttk.Label(self.status_bar, text="Desconectado", foreground='red')
        self.label_porta_status.pack(side=tk.RIGHT, padx=20)
    
    def tentar_conectar_auto(self):
        """Tenta conectar automaticamente na primeira porta disponível"""
        portas = self.get_portas_disponiveis()
        if portas:
            self.combo_porta.set(portas[0])
            self.conectar_serial()
        else:
            self.log_message("Nenhuma porta COM encontrada. Verifique a conexão USB.")
            self.status_text.config(text="Nenhuma porta COM disponível", foreground='red')
        self.root.after(3000, self.tentar_conectar_auto)
    
    def get_portas_disponiveis(self):
        """Retorna lista de portas COM disponíveis"""
        portas = []
        try:
            todas_portas = serial.tools.list_ports.comports()
            for porta in todas_portas:
                portas.append(porta.device)
        except Exception as e:
            self.log_message(f"Erro ao listar portas: {e}")
        return portas
    
    def atualizar_portas(self):
        """Atualiza a lista de portas disponíveis"""
        portas = self.get_portas_disponiveis()
        self.combo_porta['values'] = portas
        if portas:
            self.combo_porta.set(portas[0])
    
    def toggle_conexao(self):
        """Alterna conexão/desconexão"""
        if self.is_connected:
            self.desconectar_serial()
        else:
            self.conectar_serial()
    
    def conectar_serial(self):
        """Conecta à porta serial do ESP32"""
        porta = self.combo_porta.get()
        if not porta:
            messagebox.showerror("Erro", "Selecione uma porta COM")
            return
        
        try:
            self.serial_conn = serial.Serial(
                port=porta,
                baudrate=int(self.combo_baud.get()),
                bytesize=SERIAL_CONFIG['bytesize'],
                parity=SERIAL_CONFIG['parity'],
                stopbits=SERIAL_CONFIG['stopbits'],
                timeout=SERIAL_CONFIG['timeout']
            )
            
            # Pequena pausa para o ESP32 reiniciar
            time.sleep(2)
            
            # Limpar buffers
            self.serial_conn.reset_input_buffer()
            self.serial_conn.reset_output_buffer()
            
            self.is_connected = True
            self.label_porta_status.config(text=f"Conectado em {porta}", foreground='green')
            self.status_text.config(text=f"Conectado em {porta} @ {self.combo_baud.get()} baud", foreground='green')
            self.log_message(f"Conectado em {porta} @ {self.combo_baud.get()} baud")
            
            # Iniciar thread de leitura
            self.running = True
            self.thread_leitura = threading.Thread(target=self.thread_func_leitura, daemon=True)
            self.thread_leitura.start()
            
            # Atualizar interface
            self.label_estado.config(text="Estado: Conectado")
            self.btn_conectar.config(text="Desconectar")
            
        except Exception as e:
            messagebox.showerror("Erro de Conexão", f"Não foi possível conectar em {porta}:\n{e}")
            self.log_message(f"Erro ao conectar em {porta}: {e}")
            self.status_text.config(text=f"Erro ao conectar em {porta}", foreground='red')
    
    def desconectar_serial(self):
        """Desconecta a porta serial"""
        self.running = False
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
        self.is_connected = False
        self.label_porta_status.config(text="Desconectado", foreground='red')
        self.status_text.config(text="Desconectado", foreground='red')
        self.label_estado.config(text="Estado: Desconectado")
        self.btn_conectar.config(text="Conectar")
        self.log_message("Desconectado da porta serial")
    
    def thread_func_leitura(self):
        """Thread para ler dados da serial continuamente"""
        while self.running:
            try:
                if self.serial_conn and self.serial_conn.in_waiting > 0:
                    linha = self.serial_conn.readline().decode('utf-8', errors='replace').strip()
                    if linha:
                        self.processar_dados_recebidos(linha)
                time.sleep(0.01)  # Pequena pausa para não sobrecarregar CPU
            except Exception as e:
                if self.running:
                    self.root.after(0, lambda: self.log_message(f"Erro na leitura serial: {e}"))
                time.sleep(0.5)
    
    def processar_dados_recebidos(self, dados):
        """Processa dados recebidos do ESP32"""
        try:
            # Remover caracteres de controle
            dados_limpos = dados.strip()
            
            # Logar todos os dados recebidos (opcional - pode ser ruidoso)
            # self.log_message(f"Recebido: {dados_limpos}")
            
            # Parse de mensagens esperadas
            if dados_limpos.startswith('STATUS:'):
                status = dados_limpos.split(':', 1)[1]
                self.atualizar_status_serial(status)
            elif dados_limpos.startswith('AI_RESPONSE:'):
                resposta = dados_limpos.split(':', 1)[1]
                self.atualizar_resposta_ia(resposta)
            elif dados_limpos.startswith('EYES:'):
                estado_olhos = dados_limpos.split(':', 1)[1]
                self.atualizar_olhos_preview(estado_olhos)
            elif dados_limpos.startswith('BATTERY:'):
                nivel = dados_limpos.split(':', 1)[1]
                self.log_message(f"Bateria: {nivel}%")
            elif dados_limpos.startswith('TEMP:'):
                temp = dados_limpos.split(':', 1)[1]
                self.log_message(f"Temperatura: {temp}°C")
            elif dados_limpos == 'BUTTON_PRESSED':
                self.log_message("Botão pressionado no robô")
            elif dados_limpos == 'SOUND_DETECTED':
                self.log_message("Som detectado pelo sensor")
            elif dados_limpos == 'WIFI_CONNECTED':
                self.log_message("Wi-Fi conectado no robô")
            elif dados_limpos == 'WIFI_DISCONNECTED':
                self.log_message("Wi-Fi desconectado no robô")
            else:
                # Mensagem desconhecida, mostrar no log
                self.log_message(f"Mensagem desconhecida: {dados_limpos}")
                
        except Exception as e:
            self.root.after(0, lambda: self.log_message(f"Erro processando dados: {e}"))
    
    def atualizar_status_serial(self, status):
        """Atualiza interface com status do robô"""
        try:
            # Exemplo de status: "IDLE|EYES_NEUTRAL|BATT:85|WIFI:OK"
            partes = status.split('|')
            info = {}
            for parte in partes:
                if ':' in parte:
                    chave, valor = parte.split(':', 1)
                    info[chave.strip()] = valor.strip()
                else:
                    info[parte.strip()] = ""
            
            # Atolar preview de olhos
            olhos = info.get('EYES', 'N/A')
            self.root.after(0, lambda: self.atualizar_olhos_preview(olhos))
            
            # Atualizar estado
            estado_atual = info.get('STATE', 'N/A')
            self.root.after(0, lambda: self.label_estado.config(text=f"Estado: {estado_atual}"))
            
            # Wi-Fi status
            wifi = info.get('WIFI', 'N/A')
            self.root.after(0, lambda: self.label_ip.config(text=f"IP ESP32: {wifi}"))
            
        except Exception as e:
            self.log_message(f"Erro atualizando status: {e}")
    
    def atualizar_olhos_preview(self, estado):
        """Atualiza o preview dos olhos no canvas, com suporte ao RoboEyes e modo offline."""
        try:
            estado = str(estado or 'NEUTRAL').upper().strip()
            if self.eye_renderer is not None:
                try:
                    self.eye_renderer.draw(estado)
                    self.label_status_preview.config(text=f"Estado: {estado}")
                    return
                except Exception:
                    pass

            self.canvas_oled.delete("all")

            center_x = self.canvas_oled.winfo_width() // 2
            center_y = self.canvas_oled.winfo_height() // 2
            eye_radius = 60
            pupil_radius = 20

            cores = {
                'NEUTRAL': ('white', 'lightblue'),
                'HAPPY': ('white', 'yellow'),
                'THINKING': ('white', 'purple'),
                'TALKING': ('white', 'cyan'),
                'SAD': ('white', 'lightgray'),
                'ERROR': ('white', 'red'),
                'BLINK': ('white', 'white'),
            }

            cor_fundo, cor_pupila = cores.get(estado, ('white', 'white'))
            olhos_pos = [(center_x - 80, center_y), (center_x + 80, center_y)]

            for ox, oy in olhos_pos:
                self.canvas_oled.create_oval(ox - eye_radius, oy - eye_radius,
                                            ox + eye_radius, oy + eye_radius,
                                            fill=cor_fundo, outline='blue', width=2)
                pr = pupil_radius
                if estado == 'TALKING':
                    pr = pupil_radius + 5
                elif estado == 'THINKING':
                    pr = pupil_radius + 3

                self.canvas_oled.create_oval(ox - pr, oy - pr, ox + pr, oy + pr,
                                            fill=cor_pupila, outline='darkblue', width=1)

            expressoes_texto = {
                'NEUTRAL': "Neutro",
                'HAPPY': "Feliz 😊",
                'THINKING': "Pensando 🤔",
                'TALKING': "Falando 💬",
                'SAD': "Triste 😢",
                'ERROR': "Erro 💥",
            }

            texto = expressoes_texto.get(estado, "")
            self.canvas_oled.create_text(center_x, center_y + 95, text=texto, fill='white', font=('Arial', 12, 'bold'))
            self.label_status_preview.config(text=f"Estado: {estado}")

        except Exception:
            pass
    
    def desenhar_rosto_neutro(self):
        """Desenha rosto inicial neutro"""
        if self.eye_renderer is not None:
            try:
                self.eye_renderer.draw('NEUTRAL')
                self.label_status_preview.config(text='Estado: NEUTRAL')
                return
            except Exception:
                pass

        self.canvas_oled.delete("all")
        center_x = self.canvas_oled.winfo_width() // 2
        center_y = self.canvas_oled.winfo_height() // 2
        eye_radius = 60

        olhos_pos = [(center_x - 80, center_y), (center_x + 80, center_y)]

        for ox, oy in olhos_pos:
            self.canvas_oled.create_oval(ox - eye_radius, oy - eye_radius,
                                        ox + eye_radius, oy + eye_radius,
                                        fill='white', outline='blue', width=2)
            self.canvas_oled.create_oval(ox - 20, oy - 20, ox + 20, oy + 20,
                                        fill='lightblue', outline='darkblue', width=1)

        self.canvas_oled.create_text(center_x, center_y + 100,
                                    text='COSMOS', fill='white', font=('Arial', 20, 'bold'))
        self.canvas_oled.create_text(center_x, center_y + 130,
                                    text='Robô Assistente de IA', fill='white', font=('Arial', 12))
    
    def enviar_comando(self, comando):
        """Envia um comando para o ESP32 ou simula o comportamento em modo offline."""
        comandos_offline = {'LISTEN', 'IDLE', 'STATUS', 'EYES_NEUTRAL', 'EYES_HAPPY', 'EYES_THINKING', 'EYES_TALKING', 'EYES_SAD', 'EYES_ERROR'}
        comandos_reais = {'RESET', 'MOTORS_FORWARD', 'MOTORS_BACK', 'MOTORS_STOP', 'MOTORS_LEFT', 'MOTORS_RIGHT', 'BUZZER_ON', 'BUZZER_OFF', 'LED_GREEN', 'LED_YELLOW', 'LED_RED', 'GET_PROMPT'}

        if not self.is_connected or not self.serial_conn:
            if comando in comandos_offline:
                self.log_message(f"Modo offline: {comando}")
                if comando == 'STATUS':
                    self.atualizar_status_serial('STATE:SIMULADO|EYES:NEUTRAL|WIFI:OFFLINE')
                else:
                    self.atualizar_olhos_preview(comando.replace('EYES_', '').replace('LISTEN', 'TALKING').replace('IDLE', 'NEUTRAL'))
                return

            if comando in comandos_reais:
                self.log_message(f"Ação real bloqueada: {comando} (o robô não está conectado)")
                self.status_text.config(text='Modo offline - conexão necessária para componentes reais', foreground='orange')
                return

            self.log_message(f"Comando simulado: {comando}")
            return

        try:
            cmd = COMMANDS.get(comando, comando + '\n')
            self.serial_conn.write(cmd.encode('utf-8'))
            self.serial_conn.flush()
            self.log_message(f"Enviado: {comando}")
        except Exception as e:
            self.log_message(f"Erro enviando comando: {e}")
    
    def set_quick_mode(self, mode):
        self.quick_mode = mode
        self.quick_mode_var.set(mode)
        textos = {
            'offline': 'Modo 1: OFFLINE ativo. Interface e IA simuladas sem hardware.',
            'ia': 'Modo 2: IA ativa. Respostas locais ou do Ollama.',
            'voice': 'Modo 3: VOZ ativa. Fala e microfone prontos.',
            'robot': 'Modo 4: ROBÔ ativo. Só funcionará com serial conectada.'
        }
        self.status_text.config(text=textos.get(mode, 'Modo ativo'), foreground='blue')
        self.log_message(textos.get(mode, 'Modo ativo'))

        if mode == 'robot' and not self.is_connected:
            self.log_message('Atenção: o modo Robô exige conexão serial ativa para comandos reais.')

    def check_ollama_available(self):
        if requests is None:
            return False
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            return response.status_code == 200
        except Exception:
            return False

    def mostrar_status_ia(self):
        estado = "Ollama local disponível" if self.ollama_available else "modo offline / simulação local"
        self.log_message(f"Status da IA: {estado}")
        self.status_text.config(text=estado, foreground='blue')

    def gerar_resposta_ia(self, prompt):
        if self.ollama_available and requests is not None:
            try:
                payload = {
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 180}
                }
                response = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=20)
                if response.status_code == 200:
                    data = response.json()
                    resposta = (data.get('response') or '').strip()
                    if resposta:
                        return resposta
            except Exception as e:
                self.log_message(f"Ollama falhou: {e}")
        respostas_simuladas = {
            "robô": "Os robôs podem aprender e evoluir com o tempo, assim como nós humanos!",
            "fato": "O primeiro robô programável foi criado em 1948 por Alan Turing!",
            "ia": "A inteligência artificial está revolucionando o mundo ao nosso redor.",
            "voz": "A voz do robô pode ser usada para interação natural, audição e respostas em tempo real.",
            "default": "Olá! Eu sou o COSMOS, seu assistente de robô. Como posso ajudar hoje?"
        }
        prompt_lower = prompt.lower()
        for chave in ["robô", "fato", "ia", "voz"]:
            if chave in prompt_lower:
                return respostas_simuladas[chave]
        return respostas_simuladas["default"]

    def falar_resposta(self):
        if self.ai_response and self.ai_response.strip() and self.ai_response.strip() != 'Aguardando conexão...':
            self.voice.say(self.ai_response)
            self.log_message('Voz do robô ativada.')

    def ouvir_microfone(self):
        texto = self.voice.listen_once(timeout=8, phrase_time_limit=8)
        if not texto:
            self.log_message('Microfone: nenhuma fala detectada.')
            self.status_text.config(text='Microfone sem entrada', foreground='orange')
            return
        self.entry_prompt.delete(0, tk.END)
        self.entry_prompt.insert(0, texto)
        self.log_message(f'Microfone detectou: {texto}')
        self.enviar_para_ia()

    def enviar_para_ia(self):
        """Envia prompt para a API da Groq / Ollama e exibe resposta, mesmo em modo offline."""
        prompt = self.entry_prompt.get().strip()
        if not prompt:
            prompt = "Diga um fato curto e interessante sobre robôs"

        self.log_message(f"Enviando prompt para IA: {prompt}")
        self.label_prompt_atual.config(text=f"Prompt: {prompt[:30]}{'...' if len(prompt) > 30 else ''}")

        if not self.is_connected:
            self.log_message('Modo offline: IA local com simulação ativada')
            self.status_text.config(text='Modo offline - IA local ativa', foreground='orange')

        self.enviar_comando('LISTEN')
        resposta = self.gerar_resposta_ia(prompt)
        self.atualizar_resposta_ia_simulada(resposta)
        self.voice.say(resposta)
        
    def simular_resposta_ia(self, prompt):
        """Compatibilidade com versões anteriores da lógica de IA."""
        resposta = self.gerar_resposta_ia(prompt)
        self.atualizar_resposta_ia_simulada(resposta)
        if self.is_connected:
            try:
                msg = f"AI_RESPONSE:{resposta}\n"
                self.serial_conn.write(msg.encode('utf-8'))
                self.serial_conn.flush()
            except Exception:
                pass
    
    def atualizar_resposta_ia_simulada(self, resposta):
        """Atualiza a interface com a resposta da IA"""
        self.ai_response = resposta
        self.log_message(f"Resposta da IA: {resposta}")
        
        # Animar olhos "pensando" -> "falando"
        self.root.after(100, lambda: self.enviar_comando('EYES_THINKING'))
        self.root.after(300, lambda: self.enviar_comando('EYES_TALKING'))
        self.root.after(500, lambda: self.enviar_comando('EYES_HAPPY'))
        
        # Exibir no log
        self.text_logs.insert(tk.END, f"IA: {resposta}\n")
        self.text_logs.see(tk.END)
    
    def atualizar_resposta_ia(self, resposta):
        """Atualiza interface com resposta real do serial"""
        self.ai_response = resposta
        self.log_message(f"Resposta do Robô: {resposta}")
        self.text_logs.insert(tk.END, f"Robô: {resposta}\n")
        self.text_logs.see(tk.END)
        
        # Animar olhos
        self.root.after(100, lambda: self.enviar_comando('EYES_HAPPY'))
    
    def log_message(self, mensagem):
        """Adiciona mensagem à área de logs (thread-safe)"""
        try:
            self.root.after(0, lambda: self._log_message_gui(mensagem))
        except:
            pass
    
    def _log_message_gui(self, mensagem):
        """Atualiza a área de logs na GUI"""
        self.text_logs.insert(tk.END, f"{time.strftime('%H:%M:%S')} - {mensagem}\n")
        self.text_logs.see(tk.END)
    
    def atualizar_preview_manual(self):
        """Atualiza preview manualmente quando pressionado"""
        if self.is_connected:
            self.enviar_comando('STATUS')
        else:
            self.desenhar_rosto_neutro()
    
    def on_closing(self):
        """Chamado quando a janela é fechada"""
        self.running = False
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
        self.root.destroy()


# ============================================================================
# PONTO DE ENTRADA
# ============================================================================

def main():
    root = tk.Tk()
    
    # Verificar se estamos no Windows
    if platform.system() != 'Windows':
        messagebox.showwarning("Aviso", "Esta aplicação foi desenvolvida para Windows.\nContinuando mesmo assim...")
    
    # Verificar dependências
    if not HAS_PIL:
        print("AVISO: PIL/Pillow não instalado. As imagens podem ficar com qualidade reduzida.")
        print("Instale com: pip install Pillow")
    
    # Criar aplicação
    app = ControleCOSMOS(root)
    
    # Centralizar janela na tela
    root.update_idletasks()
    largura_tela = root.winfo_screenwidth()
    altura_tela = root.winfo_screenheight()
    largura_janela = root.winfo_width()
    altura_janela = root.winfo_height()
    x = (largura_tela - largura_janela) // 2
    y = (altura_tela - altura_janela) // 2
    root.geometry(f"+{x}+{y}")
    
    # Manipular fechamento da janela
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    
    # Iniciar loop principal
    root.mainloop()


if __name__ == "__main__":
    main()