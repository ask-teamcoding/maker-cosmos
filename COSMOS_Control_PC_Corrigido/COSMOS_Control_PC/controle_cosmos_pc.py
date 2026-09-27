#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
PAINEL DE CONTROLE E TESTES COSMOS ROBOT - VERSAO PROFISSIONAL COMPLETA
==============================================================================
Aplicacao Desktop para Windows / Multiplataforma para monitoramento, controle
manual de atuadores (servos, semaforo, buzzer), galeria interativa RoboEyes
e laboratorio de testes de Inteligencia Artificial com a API da Groq Cloud.

Autor: Engenheiro de Firmware Sênior & Especialista em IoT
==============================================================================
"""

import os
import sys
import time
import json
import queue
import threading
import platform
import subprocess
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox

# Dependencias opcionais tratadas com fallbacks robustos
try:
    import serial
    import serial.tools.list_ports
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False
    serial = None

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    requests = None

try:
    import pyttsx3
    HAS_TTS = True
except Exception:
    HAS_TTS = False
    pyttsx3 = None

try:
    import speech_recognition as sr
    HAS_SR = True
except Exception:
    HAS_SR = False
    sr = None

try:
    from roboeyes import EyeRenderer
    HAS_ROBOEYES = True
except Exception:
    HAS_ROBOEYES = False
    EyeRenderer = None

# ============================================================================
# CONFIGURACOES PADRAO
# ============================================================================
# A chave da Groq NAO fica mais escrita aqui no codigo. Ela e lida de um
# arquivo local "config.json" (que fica de fora do Git - veja .gitignore) ou
# da variavel de ambiente GROQ_API_KEY. Se nenhum dos dois existir, o campo
# comeca vazio e voce cola a chave manualmente na aba "Testes de IA".
#
# IMPORTANTE: se a chave antiga (que estava fixa no codigo) ja foi usada,
# considere-a comprometida e gere uma nova em https://console.groq.com/keys

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


def carregar_groq_key_salva():
    """Le a chave da Groq do config.json local ou da variavel de ambiente.
    Nunca retorna uma chave fixa embutida no codigo-fonte."""
    chave = os.environ.get("GROQ_API_KEY", "").strip()
    if chave:
        return chave
    try:
        if os.path.isfile(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                dados = json.load(f)
                return str(dados.get("groq_api_key", "")).strip()
    except Exception:
        pass
    return ""


def salvar_groq_key(chave):
    """Salva a chave digitada pelo usuario em config.json local (fora do Git)."""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({"groq_api_key": chave}, f)
        return True
    except Exception:
        return False


DEFAULT_GROQ_KEY = carregar_groq_key_salva()
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

PORTAS_COM_PADRAO = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'COM10']

# Comandos aceitos pelo firmware ESP32
COMMANDS = {
    'FORWARD': 'FORWARD\n',
    'BACK': 'BACK\n',
    'LEFT': 'LEFT\n',
    'RIGHT': 'RIGHT\n',
    'STOP': 'STOP\n',
    'EYES_NEUTRAL': 'EYES_NEUTRAL\n',
    'EYES_BLINK': 'EYES_BLINK\n',
    'EYES_HAPPY': 'EYES_HAPPY\n',
    'EYES_DEFAULT': 'EYES_DEFAULT\n',
    'EYES_TIRED': 'EYES_TIRED\n',
    'EYES_ANGRY': 'EYES_ANGRY\n',
    'EYES_CONFUSED': 'EYES_CONFUSED\n',
    'EYES_LAUGH': 'EYES_LAUGH\n',
    'EYES_THINKING': 'EYES_THINKING\n',
    'EYES_TALKING': 'EYES_TALKING\n',
    'EYES_SAD': 'EYES_SAD\n',
    'EYES_ERROR': 'EYES_ERROR\n',
    'LED_GREEN': 'LED_GREEN\n',
    'LED_YELLOW': 'LED_YELLOW\n',
    'LED_RED': 'LED_RED\n',
    'LED_OFF': 'LED_OFF\n',
    'BUZZER_ON': 'BUZZER_ON\n',
    'BUZZER_OFF': 'BUZZER_OFF\n',
    'BEEP': 'BEEP\n',
    'LISTEN': 'LISTEN\n',
    'IDLE': 'IDLE\n',
    'STATUS': 'STATUS\n',
    'RESET': 'RESET\n'
}

# ============================================================================
# CLASSE DE VOZ E TTS RESILIENTE
# ============================================================================

class VoiceAssistant:
    def __init__(self):
        self.engine = None
        self.recognizer = None
        self.microphone = None

        if HAS_TTS and pyttsx3 is not None:
            try:
                self.engine = pyttsx3.init()
                self.engine.setProperty('rate', 175)
                self.engine.setProperty('volume', 1.0)
            except Exception:
                self.engine = None

        if HAS_SR and sr is not None:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
            except Exception:
                self.recognizer = None
                self.microphone = None

    def say(self, text):
        if not text or not str(text).strip():
            return False

        # Tentar pyttsx3
        if self.engine is not None:
            try:
                self.engine.say(str(text))
                self.engine.runAndWait()
                return True
            except Exception:
                pass

        # Fallback Windows SAPI
        if platform.system() == 'Windows':
            try:
                import win32com.client
                speaker = win32com.client.Dispatch('SAPI.SpVoice')
                speaker.Speak(str(text))
                return True
            except Exception:
                pass

            try:
                txt_safe = str(text).replace('"', ' ').replace("'", " ")
                cmd = f'[System.Speech.Synthesis.SpeechSynthesizer, System.Speech, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35]::new().Speak("{txt_safe}")'
                subprocess.run(['powershell', '-NoProfile', '-Command', cmd], shell=True, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True
            except Exception:
                pass

        return False

    def listen_once(self, timeout=6):
        if not self.recognizer or not self.microphone:
            return ""
        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.4)
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=timeout)
            try:
                return self.recognizer.recognize_google(audio, language='pt-BR')
            except Exception:
                return ""
        except Exception:
            return ""

# ============================================================================
# CLASSE PRINCIPAL - CONTROLE COSMOS
# ============================================================================

class ControleCOSMOS:
    def __init__(self, root):
        self.root = root
        self.root.title("COSMOS Robot - Central de Controle & IA (ESP32 DevKit 30P)")
        self.root.geometry("1380x880")
        self.root.minsize(1150, 750)
        self.root.configure(bg="#0b1329")

        # Estado da Conexao
        self.serial_conn = None
        self.is_connected = False
        self.running_thread = False
        self.voice = VoiceAssistant()

        # Expressao Atual e Animacao
        self.current_expression = "NEUTRAL"
        self.anim_tick = 0
        self.last_blink_time = time.time()
        self.is_blinking = False
        self.blink_start = 0

        # Lista de Mini-Renderers da Galeria
        self.gallery_renderers = {}

        # Construcao da Interface
        self.aplicar_estilo_moderno()
        self.criar_interface()

        # Loop de Animacao e Piscada Natural
        self.iniciar_loop_animacao()

        # Atualizacao inicial de portas COM
        self.atualizar_portas()

    def aplicar_estilo_moderno(self):
        style = ttk.Style()
        try:
            if 'clam' in style.theme_names():
                style.theme_use('clam')
        except Exception:
            pass

        # Cores Cyberpunk/Clean Dark
        bg_dark = "#0b1329"
        bg_panel = "#131f3d"
        accent_blue = "#0ea5e9"
        fg_white = "#f8fafc"

        style.configure("TFrame", background=bg_dark)
        style.configure("TLabel", background=bg_panel, foreground=fg_white, font=("Segoe UI", 9))
        style.configure("TLabelframe", background=bg_panel, foreground=accent_blue, font=("Segoe UI", 10, "bold"))
        style.configure("TLabelframe.Label", background=bg_panel, foreground=accent_blue, font=("Segoe UI", 10, "bold"))
        style.configure("TButton", font=("Segoe UI", 9, "bold"), padding=5)
        style.configure("TNotebook", background=bg_dark, tabmargins=[2, 5, 2, 0])
        style.configure("TNotebook.Tab", font=("Segoe UI", 10, "bold"), padding=[14, 6], background="#1e293b", foreground="#94a3b8")
        style.map("TNotebook.Tab", background=[("selected", "#0284c7")], foreground=[("selected", "#ffffff")])

    def criar_interface(self):
        # Topo: Cabecalho do Robo
        header_frame = tk.Frame(self.root, bg="#070d1f", height=60)
        header_frame.pack(fill=tk.X, side=tk.TOP)

        lbl_title = tk.Label(header_frame, text="⚡ ROBÔ COSMOS - ESP32 WROOM", bg="#070d1f", fg="#38bdf8", font=("Segoe UI", 15, "bold"))
        lbl_title.pack(side=tk.LEFT, padx=18, pady=10)

        self.lbl_status_conexao = tk.Label(header_frame, text="● DESCONECTADO (Modo Simulação Ativo)", bg="#070d1f", fg="#f87171", font=("Segoe UI", 10, "bold"))
        self.lbl_status_conexao.pack(side=tk.RIGHT, padx=20, pady=10)

        # Abas Principais (Notebook)
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=8)

        # 1. Aba Controle Principal
        self.tab_controle = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_controle, text="  🎮 Painel de Controle  ")
        self.montar_aba_controle()

        # 2. Aba Galeria RoboEyes
        self.tab_galeria = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_galeria, text="  👀 Galeria RoboEyes  ")
        self.montar_aba_galeria()

        # 3. Aba Laboratorio de IA (Groq Cloud)
        self.tab_ia = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_ia, text="  🧠 Testes de IA (Groq Cloud)  ")
        self.montar_aba_ia()

        # Barra de Status Inferior
        self.status_bar = tk.Label(self.root, text="Pronto para conexao USB Serial ou Testes Locais de IA e Expressoes.", 
                                   bg="#070d1f", fg="#94a3b8", anchor=tk.W, font=("Segoe UI", 9), padx=10, pady=4)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

    # ========================================================================
    # ABA 1: PAINEL DE CONTROLE PRINCIPAL
    # ========================================================================
    def montar_aba_controle(self):
        coluna_esq = tk.Frame(self.tab_controle, bg="#0b1329", width=380)
        coluna_esq.pack(side=tk.LEFT, fill=tk.Y, padx=6, pady=6)

        coluna_centro = tk.Frame(self.tab_controle, bg="#0b1329", width=480)
        coluna_centro.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=6, pady=6)

        coluna_dir = tk.Frame(self.tab_controle, bg="#0b1329", width=420)
        coluna_dir.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=6, pady=6)

        # --- Bloco 1: Conexao Serial ---
        frame_serial = ttk.LabelFrame(coluna_esq, text="Conexao Serial ESP32", padding=10)
        frame_serial.pack(fill=tk.X, pady=(0, 8))

        tk.Label(frame_serial, text="Porta Serial (COM):", bg="#131f3d", fg="#e2e8f0").pack(anchor=tk.W)
        self.combo_portas = ttk.Combobox(frame_serial, values=PORTAS_COM_PADRAO, state="readonly")
        self.combo_portas.pack(fill=tk.X, pady=3)

        tk.Label(frame_serial, text="Baudrate (bps):", bg="#131f3d", fg="#e2e8f0").pack(anchor=tk.W, pady=(6, 0))
        self.combo_baud = ttk.Combobox(frame_serial, values=['115200', '9600', '57600'], state="readonly")
        self.combo_baud.set('115200')
        self.combo_baud.pack(fill=tk.X, pady=3)

        btn_box = tk.Frame(frame_serial, bg="#131f3d")
        btn_box.pack(fill=tk.X, pady=6)

        self.btn_conectar = tk.Button(btn_box, text="🔌 Conectar", bg="#0284c7", fg="white", font=("Segoe UI", 9, "bold"), command=self.toggle_conexao)
        self.btn_conectar.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 4))

        btn_atualizar = tk.Button(btn_box, text="🔄 Atualizar", bg="#334155", fg="white", font=("Segoe UI", 9), command=self.atualizar_portas)
        btn_atualizar.pack(side=tk.LEFT, expand=True, fill=tk.X)

        # --- Bloco 2: Controle de Motores ---
        frame_motores = ttk.LabelFrame(coluna_esq, text="Controle de Servos (Rodas)", padding=10)
        frame_motores.pack(fill=tk.X, pady=6)

        grid_mot = tk.Frame(frame_motores, bg="#131f3d")
        grid_mot.pack(pady=4)

        btn_fwd = tk.Button(grid_mot, text="▲ Frente", bg="#1e293b", fg="#38bdf8", width=9, font=("Segoe UI", 9, "bold"), command=lambda: self.enviar_comando('FORWARD'))
        btn_fwd.grid(row=0, column=1, pady=3)

        btn_left = tk.Button(grid_mot, text="◄ Esq", bg="#1e293b", fg="#38bdf8", width=9, font=("Segoe UI", 9, "bold"), command=lambda: self.enviar_comando('LEFT'))
        btn_left.grid(row=1, column=0, padx=3, pady=3)

        btn_stop = tk.Button(grid_mot, text="■ Parar", bg="#ef4444", fg="white", width=9, font=("Segoe UI", 9, "bold"), command=lambda: self.enviar_comando('STOP'))
        btn_stop.grid(row=1, column=1, padx=3, pady=3)

        btn_right = tk.Button(grid_mot, text="Dir ►", bg="#1e293b", fg="#38bdf8", width=9, font=("Segoe UI", 9, "bold"), command=lambda: self.enviar_comando('RIGHT'))
        btn_right.grid(row=1, column=2, padx=3, pady=3)

        btn_back = tk.Button(grid_mot, text="▼ Trás", bg="#1e293b", fg="#38bdf8", width=9, font=("Segoe UI", 9, "bold"), command=lambda: self.enviar_comando('BACK'))
        btn_back.grid(row=2, column=1, pady=3)

        # --- Bloco 3: Perifericos (Semaforo & Buzzer) ---
        frame_perif = ttk.LabelFrame(coluna_esq, text="Semáforo & Buzzer 5V", padding=10)
        frame_perif.pack(fill=tk.X, pady=6)

        lbl_led = tk.Label(frame_perif, text="Semáforo LED:", bg="#131f3d", fg="#94a3b8")
        lbl_led.pack(anchor=tk.W)

        row_led = tk.Frame(frame_perif, bg="#131f3d")
        row_led.pack(fill=tk.X, pady=3)
        tk.Button(row_led, text="🟢 Verde", bg="#15803d", fg="white", command=lambda: self.enviar_comando('LED_GREEN')).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=1)
        tk.Button(row_led, text="🟡 Amarelo", bg="#b45309", fg="white", command=lambda: self.enviar_comando('LED_YELLOW')).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=1)
        tk.Button(row_led, text="🔴 Vermelho", bg="#b91c1c", fg="white", command=lambda: self.enviar_comando('LED_RED')).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=1)
        tk.Button(row_led, text="✕ Off", bg="#334155", fg="white", command=lambda: self.enviar_comando('LED_OFF')).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=1)

        lbl_buz = tk.Label(frame_perif, text="Buzzer:", bg="#131f3d", fg="#94a3b8")
        lbl_buz.pack(anchor=tk.W, pady=(6, 0))

        row_buz = tk.Frame(frame_perif, bg="#131f3d")
        row_buz.pack(fill=tk.X, pady=3)
        tk.Button(row_buz, text="🔔 Beep Curto", bg="#0284c7", fg="white", command=lambda: self.enviar_comando('BEEP')).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=1)
        tk.Button(row_buz, text="Ligar", bg="#475569", fg="white", command=lambda: self.enviar_comando('BUZZER_ON')).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=1)
        tk.Button(row_buz, text="Desligar", bg="#334155", fg="white", command=lambda: self.enviar_comando('BUZZER_OFF')).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=1)

        # --- Coluna Centro: Preview OLED RoboEyes Grande ---
        frame_preview = ttk.LabelFrame(coluna_centro, text="Display OLED Facial (SSD1306 128x64)", padding=12)
        frame_preview.pack(fill=tk.BOTH, expand=True)

        self.canvas_oled = tk.Canvas(frame_preview, width=380, height=270, bg="#020817", highlightthickness=2, highlightbackground="#0284c7")
        self.canvas_oled.pack(pady=10, padx=10, fill=tk.BOTH, expand=True)

        if HAS_ROBOEYES and EyeRenderer is not None:
            self.renderer_principal = EyeRenderer(self.canvas_oled)
        else:
            self.renderer_principal = None

        # Controles Rapidos de Expressao
        box_quick_eyes = tk.Frame(frame_preview, bg="#131f3d")
        box_quick_eyes.pack(fill=tk.X, pady=4)

        for exp in ["DEFAULT", "HAPPY", "CONFUSED", "LAUGH", "TIRED", "ANGRY"]:
            btn = tk.Button(box_quick_eyes, text=exp.capitalize(), bg="#1e293b", fg="#38bdf8", 
                            font=("Segoe UI", 8, "bold"), command=lambda e=exp: self.mudar_expressao(e))
            btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=2)

        # --- Coluna Direita: Console de Logs e Telemetria ---
        frame_logs = ttk.LabelFrame(coluna_dir, text="Telemetria & Logs em Tempo Real", padding=10)
        frame_logs.pack(fill=tk.BOTH, expand=True)

        self.txt_logs = scrolledtext.ScrolledText(frame_logs, bg="#030712", fg="#38bdf8", font=("Consolas", 9), insertbackground="white")
        self.txt_logs.pack(fill=tk.BOTH, expand=True, pady=(0, 8))

        btn_clear = tk.Button(frame_logs, text="Limpar Terminal", bg="#1e293b", fg="#94a3b8", command=lambda: self.txt_logs.delete("1.0", tk.END))
        btn_clear.pack(anchor=tk.E)

        self.log("Painel COSMOS carregado com sucesso. Pronto para operacao.")

    # ========================================================================
    # ABA 2: GALERIA COMPLETA ROBOEYES
    # ========================================================================
    def montar_aba_galeria(self):
        container = tk.Frame(self.tab_galeria, bg="#0b1329")
        container.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        lbl_desc = tk.Label(container, text="Galeria de Expressões Faciais RoboEyes - COSMOS", 
                            bg="#0b1329", fg="#38bdf8", font=("Segoe UI", 13, "bold"))
        lbl_desc.pack(anchor=tk.W, pady=(0, 10))

        # Grade de Cards (3 colunas)
        grid_frame = tk.Frame(container, bg="#0b1329")
        grid_frame.pack(fill=tk.BOTH, expand=True)

        expressoes = [
            ("DEFAULT",  "Default (Repouso)",    "Olhos abertos estilo FluxGarage RoboEyes (36x36, raio 8).", "#0ea5e9"),
            ("HAPPY",    "Happy (Feliz)",        "Palpebras inferiores subindo em arco suave (estilo anime).", "#34d399"),
            ("CONFUSED", "Confused (Pensando)",  "Animacao oficial anim_confused() com balanco horizontal.", "#fbbf24"),
            ("LAUGH",    "Laugh (Rindo / Fala)", "Animacao oficial anim_laugh() com pulos verticais animados.", "#38bdf8"),
            ("TIRED",    "Tired (Cansado/Triste)","Palpebras superiores inclinadas para baixo.", "#94a3b8"),
            ("ANGRY",    "Angry (Alerta / Erro)","Palpebras anguladas em expressao de alerta.", "#f87171"),
            ("BLINK",    "Blink (Piscar)",       "Fechamento e reabertura suave dos olhos.", "#67e8f9"),
            ("THINKING", "Norte (Olhar p/ Cima)","Posicao cardinal N olhando para cima durante consulta Groq.", "#a855f7"),
            ("TALKING",  "Talking (Falando)",    "Feliz + vibracao vertical, usado enquanto o COSMOS fala a resposta.", "#22d3ee"),
        ]

        row = 0
        col = 0
        for code, titulo, desc, cor in expressoes:
            card = tk.Frame(grid_frame, bg="#131f3d", highlightbackground=cor, highlightthickness=1, padx=8, pady=8)
            card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")

            grid_frame.columnconfigure(col, weight=1)
            grid_frame.rowconfigure(row, weight=1)

            # Mini Canvas para a expressao
            c = tk.Canvas(card, width=170, height=115, bg="#020817", highlightthickness=1, highlightbackground="#1e293b")
            c.pack(pady=4)

            if HAS_ROBOEYES and EyeRenderer is not None:
                renderer = EyeRenderer(c)
                renderer.draw(code)
                self.gallery_renderers[code] = (c, renderer)

            tk.Label(card, text=titulo, bg="#131f3d", fg=cor, font=("Segoe UI", 10, "bold")).pack(anchor=tk.W, pady=(4, 0))
            tk.Label(card, text=desc, bg="#131f3d", fg="#94a3b8", font=("Segoe UI", 8), wraplength=170, justify=tk.LEFT).pack(anchor=tk.W)

            btn_box = tk.Frame(card, bg="#131f3d")
            btn_box.pack(fill=tk.X, pady=(6, 2))

            btn_ver = tk.Button(btn_box, text="Preview", bg="#1e293b", fg="#e2e8f0", font=("Segoe UI", 8), 
                                command=lambda e=code: self.mudar_expressao(e))
            btn_ver.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 2))

            btn_env = tk.Button(btn_box, text="Enviar Robô", bg="#0284c7", fg="white", font=("Segoe UI", 8, "bold"), 
                                command=lambda e=code: self.enviar_comando(f"EYES_{e}"))
            btn_env.pack(side=tk.RIGHT, expand=True, fill=tk.X)

            col += 1
            if col > 3:
                col = 0
                row += 1

    # ========================================================================
    # ABA 3: LABORATORIO DE TESTES DE IA (GROQ CLOUD)
    # ========================================================================
    def montar_aba_ia(self):
        painel_ia = tk.Frame(self.tab_ia, bg="#0b1329")
        painel_ia.pack(fill=tk.BOTH, expand=True, padx=14, pady=14)

        # Configuracao de Chave e Modelo
        frame_config = ttk.LabelFrame(painel_ia, text="Configuração da API Groq Cloud", padding=10)
        frame_config.pack(fill=tk.X, pady=(0, 10))

        row1 = tk.Frame(frame_config, bg="#131f3d")
        row1.pack(fill=tk.X, pady=3)

        tk.Label(row1, text="API Key:", bg="#131f3d", fg="#e2e8f0", width=12, anchor=tk.W).pack(side=tk.LEFT)
        self.entry_groq_key = ttk.Entry(row1, width=55, show="*")
        self.entry_groq_key.pack(side=tk.LEFT, padx=6, fill=tk.X, expand=True)
        if DEFAULT_GROQ_KEY:
            self.entry_groq_key.insert(0, DEFAULT_GROQ_KEY)

        self.chk_mostrar_key_var = tk.BooleanVar(value=False)
        chk_mostrar = tk.Checkbutton(row1, text="Mostrar", variable=self.chk_mostrar_key_var,
                                      bg="#131f3d", fg="#94a3b8", selectcolor="#131f3d",
                                      command=self.toggle_mostrar_key)
        chk_mostrar.pack(side=tk.LEFT, padx=(4, 0))

        btn_salvar_key = tk.Button(row1, text="💾 Salvar chave", bg="#334155", fg="white",
                                    font=("Segoe UI", 8, "bold"), command=self.salvar_key_ui)
        btn_salvar_key.pack(side=tk.LEFT, padx=(6, 0))

        row2 = tk.Frame(frame_config, bg="#131f3d")
        row2.pack(fill=tk.X, pady=3)

        tk.Label(row2, text="Modelo IA:", bg="#131f3d", fg="#e2e8f0", width=12, anchor=tk.W).pack(side=tk.LEFT)
        self.combo_groq_model = ttk.Combobox(row2, values=[
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it"
        ], state="readonly", width=30)
        self.combo_groq_model.set(DEFAULT_GROQ_MODEL)
        self.combo_groq_model.pack(side=tk.LEFT, padx=6)

        # Prompt de Teste
        frame_prompt = ttk.LabelFrame(painel_ia, text="Envio de Prompt para Testes", padding=10)
        frame_prompt.pack(fill=tk.X, pady=(0, 10))

        self.entry_prompt = ttk.Entry(frame_prompt, font=("Segoe UI", 10))
        self.entry_prompt.pack(fill=tk.X, pady=4)
        self.entry_prompt.insert(0, "Diga um fato curto e incrível sobre robótica e espaço.")

        botoes_ia = tk.Frame(frame_prompt, bg="#131f3d")
        botoes_ia.pack(fill=tk.X, pady=4)

        btn_testar_pc = tk.Button(botoes_ia, text="🚀 Testar Groq no PC (Direto)", bg="#0284c7", fg="white", 
                                  font=("Segoe UI", 9, "bold"), command=self.testar_groq_pc)
        btn_testar_pc.pack(side=tk.LEFT, padx=(0, 6))

        btn_enviar_esp = tk.Button(botoes_ia, text="📡 Enviar Prompt para o ESP32", bg="#15803d", fg="white", 
                                   font=("Segoe UI", 9, "bold"), command=self.enviar_prompt_esp32)
        btn_enviar_esp.pack(side=tk.LEFT, padx=(0, 6))

        btn_ouvir = tk.Button(botoes_ia, text="🎙️ Falar no Microfone", bg="#334155", fg="white", command=self.ouvir_microfone)
        btn_ouvir.pack(side=tk.LEFT, padx=(0, 6))

        btn_falar = tk.Button(botoes_ia, text="🔊 Falar Resposta (TTS)", bg="#334155", fg="white", command=self.falar_resposta_tts)
        btn_falar.pack(side=tk.LEFT)

        # Historico da Conversa
        frame_chat = ttk.LabelFrame(painel_ia, text="Resposta da Inteligência Artificial", padding=10)
        frame_chat.pack(fill=tk.BOTH, expand=True)

        self.txt_resposta_ia = scrolledtext.ScrolledText(frame_chat, bg="#030712", fg="#a7f3d0", font=("Segoe UI", 10), wrap=tk.WORD)
        self.txt_resposta_ia.pack(fill=tk.BOTH, expand=True)
        self.txt_resposta_ia.insert(tk.END, "COSMOS: Olá! Estou pronto para processar suas perguntas via Groq Cloud.")

    # ========================================================================
    # LOGICA DE COMUNICACAO E SERIAL
    # ========================================================================
    def atualizar_portas(self):
        portas = []
        if HAS_SERIAL and serial is not None:
            try:
                for p in serial.tools.list_ports.comports():
                    portas.append(p.device)
            except Exception:
                pass
        if not portas:
            portas = PORTAS_COM_PADRAO
        self.combo_portas['values'] = portas
        if portas:
            self.combo_portas.set(portas[0])

    def toggle_conexao(self):
        if self.is_connected:
            self.desconectar()
        else:
            self.conectar()

    def conectar(self):
        porta = self.combo_portas.get()
        baud = int(self.combo_baud.get() or 115200)

        if not HAS_SERIAL:
            messagebox.showwarning("Aviso", "A biblioteca pyserial não está instalada. Operando em Modo Simulação.")
            return

        try:
            self.serial_conn = serial.Serial(porta, baud, timeout=0.8)
            time.sleep(1.5)
            self.serial_conn.reset_input_buffer()

            self.is_connected = True
            self.running_thread = True
            self.btn_conectar.config(text="Desconectar", bg="#ef4444")
            self.lbl_status_conexao.config(text=f"● CONECTADO EM {porta} ({baud} bps)", fg="#4ade80")
            self.status_bar.config(text=f"Conectado com sucesso ao robô na porta {porta}.")
            self.log(f"Conexao estabelecida em {porta} @ {baud} bps.")

            # Inicia Thread de Leitura
            t = threading.Thread(target=self.thread_leitura_serial, daemon=True)
            t.start()

            # Pede status imediato
            self.enviar_comando('STATUS')

        except Exception as e:
            messagebox.showerror("Erro de Conexão", f"Falha ao conectar em {porta}:\n{e}")
            self.log(f"Erro de conexao: {e}")

    def desconectar(self):
        self.running_thread = False
        if self.serial_conn and self.serial_conn.is_open:
            try:
                self.serial_conn.close()
            except Exception:
                pass
        self.is_connected = False
        self.btn_conectar.config(text="🔌 Conectar", bg="#0284c7")
        self.lbl_status_conexao.config(text="● DESCONECTADO (Modo Simulação)", fg="#f87171")
        self.status_bar.config(text="Desconectado da porta serial.")
        self.log("Porta serial fechada.")

    def enviar_comando(self, nome_cmd):
        cmd_str = COMMANDS.get(nome_cmd, f"{nome_cmd}\n")
        if self.is_connected and self.serial_conn:
            try:
                self.serial_conn.write(cmd_str.encode('utf-8'))
                self.serial_conn.flush()
                self.log(f">> Enviado ao robô: {nome_cmd}")
            except Exception as e:
                self.log(f"Erro ao enviar comando: {e}")
        else:
            # Modo simulado: atualiza o preview local se for comando de olhos
            self.log(f"[SIMULACAO] Comando executado localmente: {nome_cmd}")
            if nome_cmd.startswith("EYES_"):
                exp = nome_cmd.replace("EYES_", "")
                self.mudar_expressao(exp)

    def thread_leitura_serial(self):
        while self.running_thread and self.is_connected:
            try:
                if self.serial_conn and self.serial_conn.in_waiting > 0:
                    linha = self.serial_conn.readline().decode('utf-8', errors='replace').strip()
                    if linha:
                        self.root.after(0, lambda l=linha: self.processar_mensagem_recebida(l))
                time.sleep(0.01)
            except Exception as e:
                time.sleep(0.5)

    def processar_mensagem_recebida(self, msg):
        self.log(f"<< ESP32: {msg}")

        if msg.startswith("EYES:"):
            exp = msg.split(":", 1)[1].strip()
            self.mudar_expressao(exp)
        elif msg.startswith("AI_RESPONSE:"):
            resp = msg.split(":", 1)[1].strip()
            self.txt_resposta_ia.delete("1.0", tk.END)
            self.txt_resposta_ia.insert(tk.END, f"COSMOS (via ESP32):\n{resp}")
            self.voice.say(resp)
        elif msg.startswith("STATUS:"):
            # Ex: STATUS:STATE:IDLE|EYES:NEUTRAL|WIFI:192.168.0.15
            self.status_bar.config(text=f"Telemetria do Robô: {msg}")

    # ========================================================================
    # LOGICA DE IA (GROQ CLOUD)
    # ========================================================================
    def toggle_mostrar_key(self):
        self.entry_groq_key.config(show="" if self.chk_mostrar_key_var.get() else "*")

    def salvar_key_ui(self):
        chave = self.entry_groq_key.get().strip()
        if not chave:
            messagebox.showwarning("Aviso", "Digite uma chave antes de salvar.")
            return
        if salvar_groq_key(chave):
            self.log("Chave da Groq salva em config.json (arquivo local, fora do Git).")
            self.status_bar.config(text="Chave da Groq salva localmente.")
        else:
            messagebox.showerror("Erro", "Não foi possível salvar o arquivo config.json.")

    def testar_groq_pc(self):
        prompt = self.entry_prompt.get().strip()
        api_key = self.entry_groq_key.get().strip()
        model = self.combo_groq_model.get().strip()

        if not prompt:
            prompt = "Diga um fato curto sobre tecnologia."

        if not HAS_REQUESTS:
            messagebox.showerror("Erro", "A biblioteca 'requests' é necessária para chamadas HTTP no Python.\nInstale com: pip install requests")
            return

        self.mudar_expressao("THINKING")
        self.status_bar.config(text="Consultando API da Groq...")
        self.log(f"[GROQ PC] Enviando prompt: '{prompt}'")

        # Dispara em thread para nao congelar a tela
        threading.Thread(target=self._executar_chamada_groq, args=(api_key, model, prompt), daemon=True).start()

    def _executar_chamada_groq(self, api_key, model, prompt):
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "Voce e o COSMOS, robo assistente simpatico. Responda em no maximo 2 frases curtas, em portugues."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 100,
            "temperature": 0.7
        }

        t0 = time.time()
        try:
            res = requests.post(GROQ_ENDPOINT, json=payload, headers=headers, timeout=12)
            tempo_ms = int((time.time() - t0) * 1000)

            if res.status_code == 200:
                data = res.json()
                resposta = data["choices"][0]["message"]["content"].strip()
                self.root.after(0, lambda: self._sucesso_groq(resposta, tempo_ms))
            else:
                erro_msg = f"HTTP {res.status_code}: {res.text}"
                self.root.after(0, lambda: self._falha_groq(erro_msg))
        except Exception as e:
            self.root.after(0, lambda: self._falha_groq(str(e)))

    def _sucesso_groq(self, resposta, tempo_ms):
        self.mudar_expressao("TALKING")
        self.txt_resposta_ia.delete("1.0", tk.END)
        self.txt_resposta_ia.insert(tk.END, f"COSMOS ({tempo_ms} ms):\n{resposta}")
        self.log(f"[GROQ PC] Resposta recebida em {tempo_ms} ms: {resposta}")
        self.status_bar.config(text=f"Groq Cloud respondeu com sucesso em {tempo_ms} ms.")

        # Fala por voz
        threading.Thread(target=lambda: (self.voice.say(resposta), self.root.after(100, lambda: self.mudar_expressao("HAPPY"))), daemon=True).start()

    def _falha_groq(self, erro):
        self.mudar_expressao("ERROR")
        self.txt_resposta_ia.delete("1.0", tk.END)
        self.txt_resposta_ia.insert(tk.END, f"ERRO NA API GROQ:\n{erro}")
        self.log(f"[ERRO GROQ] {erro}")
        self.status_bar.config(text="Falha na requisicao da API Groq.")

    def enviar_prompt_esp32(self):
        prompt = self.entry_prompt.get().strip()
        if not prompt:
            prompt = "Diga um fato sobre robos."

        if self.is_connected:
            self.enviar_comando(f"PROMPT:{prompt}")
            self.log(f"Prompt enviado ao ESP32: {prompt}")
        else:
            messagebox.showinfo("Modo Simulação", "O robô ESP32 não está conectado via Serial.\nTestando a chamada diretamente pelo PC.")
            self.testar_groq_pc()

    def ouvir_microfone(self):
        self.status_bar.config(text="Ouvindo microfone... Fale agora.")
        self.log("Microfone ativado. Aguardando fala...")

        def _escutar():
            txt = self.voice.listen_once(timeout=6)
            if txt:
                self.root.after(0, lambda: self._set_prompt_e_enviar(txt))
            else:
                self.root.after(0, lambda: self.status_bar.config(text="Nenhuma fala detectada."))

        threading.Thread(target=_escutar, daemon=True).start()

    def _set_prompt_e_enviar(self, texto):
        self.entry_prompt.delete(0, tk.END)
        self.entry_prompt.insert(0, texto)
        self.log(f"Voz reconhecida: '{texto}'")
        self.testar_groq_pc()

    def falar_resposta_tts(self):
        txt = self.txt_resposta_ia.get("1.0", tk.END).strip()
        if txt:
            threading.Thread(target=lambda: self.voice.say(txt), daemon=True).start()

    # ========================================================================
    # ANIMACAO E RENDERIZACAO DOS OLHOS
    # ========================================================================
    def mudar_expressao(self, exp):
        self.current_expression = str(exp).upper().strip()
        if self.renderer_principal:
            self.renderer_principal.draw(self.current_expression)
        self.log(f"Expressão facial alterada para: {self.current_expression}")

    def iniciar_loop_animacao(self):
        self.anim_tick += 1
        agora = time.time()

        # Animacao de piscada natural suave no modo repouso (NEUTRAL)
        if self.current_expression == "NEUTRAL":
            if not self.is_blinking and (agora - self.last_blink_time > 4.2):
                self.is_blinking = True
                self.blink_start = agora
                if self.renderer_principal:
                    self.renderer_principal.draw("BLINK", self.anim_tick)

            elif self.is_blinking and (agora - self.blink_start > 0.15):
                self.is_blinking = False
                self.last_blink_time = agora
                if self.renderer_principal:
                    self.renderer_principal.draw("NEUTRAL", self.anim_tick)

        # Se estiver falando, mantem a animacao do equalizador de audio ativa
        elif self.current_expression == "TALKING":
            if self.renderer_principal:
                self.renderer_principal.draw("TALKING", self.anim_tick)

        # Repete a cada 60 ms (~16 FPS para suavidade sem pesar a CPU)
        self.root.after(60, self.iniciar_loop_animacao)

    def log(self, texto):
        ts = time.strftime("%H:%M:%S")
        self.txt_logs.insert(tk.END, f"[{ts}] {texto}\n")
        self.txt_logs.see(tk.END)

# ============================================================================
# PONTO DE ENTRADA
# ============================================================================

def main():
    root = tk.Tk()
    app = ControleCOSMOS(root)
    root.mainloop()

if __name__ == "__main__":
    main()
