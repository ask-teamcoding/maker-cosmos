import math
import time
import tkinter as tk

class EyeRenderer:
    """
    Simulador e Renderizador oficial em Python fiel a biblioteca FluxGarage RoboEyes
    (https://github.com/FluxGarage/RoboEyes por Dennis Hoelscher).

    Implementa a estetica classica dos blocos arredondados (36x36, raio 8, espaco 10),
    os humores (DEFAULT, HAPPY, TIRED, ANGRY), as posicoes cardeais (N, S, E, W, DEFAULT)
    e as animacoes especiais (CONFUSED, LAUGH, BLINK, FLICKER).
    """

    # Definicoes oficiais de Humores e Animacoes
    EXPRESSIONS = [
        ("DEFAULT",   "Neutro / Default",   "Olhos abertos retangulares arredondados no centro."),
        ("BLINK",     "Piscar (Blink)",     "Palpebras fechando e abrindo suavemente."),
        ("HAPPY",     "Feliz (Happy)",      "Palpebras inferiores subindo em arco suave (estilo anime)."),
        ("THINKING",  "Pensando (Norte)",   "Olhar direcionado para cima com animacao de busca."),
        ("CONFUSED",  "Confuso / Busca",    "Olhos balancando rapidamente na horizontal."),
        ("LAUGH",     "Rindo / Alegria",    "Olhos pulando suavemente na vertical."),
        ("TIRED",     "Cansado / Triste",   "Palpebras superiores descendo inclinadas."),
        ("ANGRY",     "Alerta / Bravo",     "Palpebras superiores com corte angular de alerta."),
        ("TALKING",   "Falando (Talking)",  "Feliz + barra de audio animada, usado enquanto o COSMOS fala.")
    ]

    def __init__(self, canvas):
        self.canvas = canvas
        self.mood = "DEFAULT"
        self.position = "DEFAULT"
        self.anim_tick = 0
        
        # Geometria base do FluxGarage RoboEyes (em pixels base)
        self.eye_w = 36.0
        self.eye_h = 36.0
        self.border_r = 8.0
        self.space_between = 10.0

    def draw(self, estado="DEFAULT", tick=None):
        estado_clean = str(estado or "DEFAULT").upper().strip()
        
        # Mapeamento de sinonimos para compatibilidade total
        if estado_clean in ["NEUTRAL", "IDLE"]:
            self.mood = "DEFAULT"
            self.position = "DEFAULT"
        elif estado_clean in ["SAD"]:
            self.mood = "TIRED"
            self.position = "S"
        elif estado_clean in ["ERROR", "ALERT"]:
            self.mood = "ANGRY"
            self.position = "DEFAULT"
        elif estado_clean in ["THINKING"]:
            self.mood = "DEFAULT"
            self.position = "N"
        elif estado_clean in ["TALKING"]:
            self.mood = "TALKING"
            self.position = "DEFAULT"
        else:
            self.mood = estado_clean

        if tick is not None:
            self.anim_tick = tick
        else:
            self.anim_tick += 1

        self.canvas.delete("all")

        # Resolucao e Fator de Escala Proporcional
        self.canvas.update_idletasks()
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        if cw < 40:
            cw = int(self.canvas.cget("width") or 320)
        if ch < 40:
            ch = int(self.canvas.cget("height") or 240)

        cx = cw / 2.0
        cy = ch / 2.0
        scale = min(cw / 128.0, ch / 64.0) * 0.85

        # Fundo Display OLED SSD1306
        self.canvas.create_rectangle(0, 0, cw, ch, fill="#020817", outline="")
        b_margin = 8 * (scale / 2.0)
        self.canvas.create_rectangle(b_margin, b_margin, cw - b_margin, ch - b_margin, 
                                     outline="#0f172a", width=2, fill="#030712")

        # Dimensoes escaladas
        ew = self.eye_w * scale
        eh = self.eye_h * scale
        sp = self.space_between * scale
        br = self.border_r * scale

        # Deslocamento por Posicao Cardinal (FluxGarage)
        pos_dx = 0.0
        pos_dy = 0.0
        if self.position == "N":
            pos_dy = -8.0 * scale
        elif self.position == "S":
            pos_dy = 8.0 * scale
        elif self.position == "E":
            pos_dx = 12.0 * scale
        elif self.position == "W":
            pos_dx = -12.0 * scale

        # Animacoes especiais (Confused, Laugh, Flicker)
        if self.mood == "CONFUSED":
            pos_dx += math.sin(self.anim_tick * 0.8) * 8.0 * scale
        elif self.mood == "LAUGH":
            pos_dy += math.sin(self.anim_tick * 0.9) * 5.0 * scale
        elif self.mood == "TALKING":
            pos_dy += math.sin(self.anim_tick * 1.6) * 2.0 * scale

        # Coordenadas dos Olhos Esquerdo e Direito
        total_eyes_w = (ew * 2.0) + sp
        start_x = cx - (total_eyes_w / 2.0) + pos_dx
        base_y = cy - (eh / 2.0) + pos_dy

        # Modificadores de Humores
        is_blink = (self.mood == "BLINK")

        for eye_idx in (0, 1): # 0 = esquerdo, 1 = direito
            ox = start_x + (eye_idx * (ew + sp))
            oy = base_y

            if is_blink:
                # Piscada: olho fica como uma fenda fina, azul e mais agressiva
                fh = max(2, int(3.0 * scale))
                mid_y = oy + (eh / 2.0)
                self.canvas.create_rectangle(ox, mid_y - fh, ox + ew, mid_y + fh,
                                            fill="#7dd3fc", outline="#38bdf8", width=max(1, int(1.2 * scale)))
                continue

            # Paleta principal azul robótica com luz interna para tornar os olhos mais vivos
            if self.mood == "DEFAULT":
                eye_fill = "#dbeafe"
                eye_outline = "#38bdf8"
            elif self.mood == "HAPPY":
                eye_fill = "#bae6fd"
                eye_outline = "#0ea5e9"
            elif self.mood == "TIRED":
                eye_fill = "#bfdbfe"
                eye_outline = "#2563eb"
            elif self.mood == "ANGRY":
                eye_fill = "#dbeafe"
                eye_outline = "#1d4ed8"
            elif self.mood == "CONFUSED":
                eye_fill = "#dbeafe"
                eye_outline = "#60a5fa"
            elif self.mood == "LAUGH":
                eye_fill = "#e0f2fe"
                eye_outline = "#38bdf8"
            elif self.mood == "TALKING":
                eye_fill = "#cffafe"
                eye_outline = "#22d3ee"
            else:
                eye_fill = "#dbeafe"
                eye_outline = "#38bdf8"

            # Desenha o bloco arredondado principal (FluxGarage RoboEyes)
            self.draw_rounded_rect(ox, oy, ox + ew, oy + eh, radius=br,
                                   fill=eye_fill, outline=eye_outline,
                                   width=max(1, int(1.2 * scale)))

            # Lens premium: torna o olhar azul e tecnológico com pupila escura e reflexo
            inner_pad = max(4.0, 0.18 * ew)
            inner_x1 = ox + inner_pad
            inner_y1 = oy + inner_pad
            inner_x2 = ox + ew - inner_pad
            inner_y2 = oy + eh - inner_pad
            self.draw_rounded_rect(inner_x1, inner_y1, inner_x2, inner_y2,
                                   radius=max(2.0, br * 0.55),
                                   fill="#e0f2fe", outline="#93c5fd",
                                   width=max(1, int(1.0 * scale)))

            look_shift_x = 0.0
            look_shift_y = 0.0
            if self.position == "E":
                look_shift_x = ew * 0.12
            elif self.position == "W":
                look_shift_x = -ew * 0.12
            elif self.position == "N":
                look_shift_y = -eh * 0.10
            elif self.position == "S":
                look_shift_y = eh * 0.10

            if self.mood == "CONFUSED":
                look_shift_x += math.sin(self.anim_tick * 0.9 + eye_idx) * 8.0 * scale
            elif self.mood == "LAUGH":
                look_shift_y += math.sin(self.anim_tick * 1.1 + eye_idx) * 5.0 * scale
            elif self.mood == "ANGRY":
                look_shift_x += (5.0 * scale) if eye_idx == 0 else (-5.0 * scale)
            elif self.mood == "TIRED":
                look_shift_y += 2.0 * scale

            pupil_w = max(7.0 * scale, ew * 0.28)
            pupil_h = max(7.0 * scale, eh * 0.30)
            if self.mood == "ANGRY":
                pupil_w *= 0.75
                pupil_h *= 0.9
            elif self.mood == "TIRED":
                pupil_h *= 0.8
            elif self.mood == "HAPPY":
                pupil_w *= 1.12
                pupil_h *= 1.08

            pupil_x1 = ox + (ew / 2.0) - (pupil_w / 2.0) + look_shift_x
            pupil_y1 = oy + (eh / 2.0) - (pupil_h / 2.0) + look_shift_y
            self.canvas.create_oval(pupil_x1, pupil_y1, pupil_x1 + pupil_w, pupil_y1 + pupil_h,
                                    fill="#020817", outline="#020817", width=1)

            glow_w = max(2.0 * scale, pupil_w * 0.34)
            glow_h = max(2.0 * scale, pupil_h * 0.34)
            self.canvas.create_oval(pupil_x1 + pupil_w * 0.32, pupil_y1 + pupil_h * 0.18,
                                    pupil_x1 + pupil_w * 0.32 + glow_w, pupil_y1 + pupil_h * 0.18 + glow_h,
                                    fill="#f8fafc", outline="")

            # Efeitos de Palpebra do FluxGarage RoboEyes
            if self.mood == "HAPPY":
                # Palpebra inferior sobe cortando a parte de baixo (curva feliz)
                cut_h = eh * 0.42
                self.canvas.create_arc(ox - (4 * scale), oy + eh - (cut_h * 2), ox + ew + (4 * scale), oy + eh + (8 * scale),
                                       start=0, extent=180, fill="#030712", outline="#030712")
                cheek_r = max(4, int(8 * scale))
                self.canvas.create_oval(ox - cheek_r, oy + eh - cheek_r * 0.5,
                                        ox + cheek_r, oy + eh + cheek_r * 0.5,
                                        fill="#7dd3fc", outline="")
                self.canvas.create_oval(ox + ew - cheek_r, oy + eh - cheek_r * 0.5,
                                        ox + ew + cheek_r, oy + eh + cheek_r * 0.5,
                                        fill="#7dd3fc", outline="")
            
            elif self.mood == "TIRED":
                # Palpebra superior inclinada para baixo (olhar caido/cansado)
                eyelid_h = eh * 0.45
                if eye_idx == 0:
                    pts = [ox - 2, oy - 2, ox + ew + 2, oy - 2, ox + ew + 2, oy + eyelid_h, ox - 2, oy + (eyelid_h * 0.4)]
                else:
                    pts = [ox - 2, oy - 2, ox + ew + 2, oy - 2, ox + ew + 2, oy + (eyelid_h * 0.4), ox - 2, oy + eyelid_h]
                self.canvas.create_polygon(pts, fill="#030712", outline="")

            elif self.mood == "ANGRY":
                # Palpebra superior com angulo oposto (olhar determinado/bravo)
                eyelid_h = eh * 0.45
                if eye_idx == 0:
                    pts = [ox - 2, oy - 2, ox + ew + 2, oy - 2, ox + ew + 2, oy + (eyelid_h * 0.3), ox - 2, oy + eyelid_h]
                else:
                    pts = [ox - 2, oy - 2, ox + ew + 2, oy - 2, ox + ew + 2, oy + eyelid_h, ox - 2, oy + (eyelid_h * 0.3)]
                self.canvas.create_polygon(pts, fill="#030712", outline="")
                brow_y = oy - 5 * scale
                self.canvas.create_line(ox - 2, brow_y, ox + ew * 0.6, brow_y - 4 * scale, fill="#38bdf8", width=max(1, int(2 * scale)))
                self.canvas.create_line(ox + ew * 0.4, brow_y - 4 * scale, ox + ew + 2, brow_y, fill="#38bdf8", width=max(1, int(2 * scale)))

            elif self.mood == "CONFUSED":
                self.canvas.create_line(ox + ew * 0.2, oy + eh * 0.25, ox + ew * 0.7, oy + eh * 0.25, fill="#0f172a", width=max(1, int(2 * scale)))

            elif self.mood == "LAUGH":
                self.canvas.create_arc(ox - 2, oy + eh * 0.35, ox + ew + 2, oy + eh * 0.9,
                                       start=200, extent=120, style=tk.ARC, outline="#0f172a", width=max(1, int(2 * scale)))

        # Barra de audio animada durante o estado TALKING (fala da IA)
        if self.mood == "TALKING":
            n_bars = 5
            bar_w = 5.0 * scale
            bar_gap = 4.0 * scale
            total_w = (n_bars * bar_w) + ((n_bars - 1) * bar_gap)
            bar_x0 = cx - (total_w / 2.0)
            bar_base_y = base_y + eh + (14.0 * scale)
            for i in range(n_bars):
                h = (6.0 + 5.0 * abs(math.sin(self.anim_tick * 0.5 + i * 1.3))) * scale
                bx = bar_x0 + i * (bar_w + bar_gap)
                self.canvas.create_rectangle(bx, bar_base_y - h, bx + bar_w, bar_base_y,
                                             fill="#22d3ee", outline="")

        # Tag sutil indicativa do FluxGarage RoboEyes
        tag_size = max(7, int(7.5 * scale))
        self.canvas.create_text(cx, ch - (12 * scale), text=f"FLUXGARAGE ROBOEYES • {self.mood}", 
                                fill="#0284c7", font=("Segoe UI", tag_size, "bold"))

    def draw_rounded_rect(self, x1, y1, x2, y2, radius=8, **kwargs):
        """Desenha um retangulo com cantos arredondados perfeitos no Tkinter."""
        points = [
            x1 + radius, y1,
            x2 - radius, y1,
            x2, y1,
            x2, y1 + radius,
            x2, y2 - radius,
            x2, y2,
            x2 - radius, y2,
            x1 + radius, y2,
            x1, y2,
            x1, y2 - radius,
            x1, y1 + radius,
            x1, y1
        ]
        return self.canvas.create_polygon(points, smooth=True, **kwargs)

    def set_expression(self, estado="DEFAULT"):
        self.draw(estado)

    def update(self, estado="DEFAULT"):
        self.draw(estado)

RoboEyesRenderer = EyeRenderer
