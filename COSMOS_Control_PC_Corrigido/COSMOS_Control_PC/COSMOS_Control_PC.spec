# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['controle_cosmos_pc.py'],
    pathex=[],
    binaries=[],
    datas=[],
    # pyttsx3/speech_recognition/win32com SAO usados pela classe VoiceAssistant
    # (TTS e microfone). Antes eles estavam na lista de "excludes" abaixo, o
    # que fazia o .exe compilar sem esses recursos mesmo com os botoes de voz
    # visiveis na interface. Agora ficam como hiddenimports para irem para o
    # pacote final.
    hiddenimports=[
        'roboeyes', 'serial', 'requests',
        'pyttsx3', 'pyttsx3.drivers', 'pyttsx3.drivers.sapi5',
        'speech_recognition', 'win32com', 'win32com.client', 'comtypes',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'numpy', 'pandas', 'scipy', 'matplotlib', 'IPython', 'jupyter', 'PIL',
        'cv2', 'sympy', 'PyQt5', 'PyQt6', 'pytest', 'pytz', 'dateutil',
        'pydoc', 'doctest', 'tkinter.test', 'idlelib', 'lib2to3',
        # Estes 3 nao sao importados em nenhum lugar do codigo - seguro excluir:
        'pyaudio', 'sounddevice', 'soundfile', 'vosk'
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='COSMOS_Control_PC',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
