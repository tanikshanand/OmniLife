import os
import sys
from PIL import Image, ImageDraw, ImageFont

def generate_flowchart(output_path="flowchart_architecture.png"):
    # Create high-res flowchart image for academic publication
    width = 1000
    height = 1900
    img = Image.new("RGB", (width, height), color="#ffffff")
    draw = ImageDraw.Draw(img)

    # Use default font or truetype if available
    try:
        font_title = ImageFont.truetype("arialbd.ttf", 22)
        font_box_title = ImageFont.truetype("arialbd.ttf", 18)
        font_box_sub = ImageFont.truetype("arial.ttf", 14)
        font_label = ImageFont.truetype("arialbd.ttf", 13)
    except:
        font_title = ImageFont.load_default()
        font_box_title = ImageFont.load_default()
        font_box_sub = ImageFont.load_default()
        font_label = ImageFont.load_default()

    # Draw helper functions
    def draw_rounded_box(xy, fill, outline, radius=12, width=2):
        x1, y1, x2, y2 = xy
        draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=outline, width=width)

    def draw_arrow(start, end, color="#1e293b", width=3):
        x1, y1 = start
        x2, y2 = end
        draw.line([x1, y1, x2, y2], fill=color, width=width)
        # arrowhead
        arrow_size = 8
        if y2 > y1: # downward
            draw.polygon([(x2, y2), (x2 - arrow_size, y2 - arrow_size * 1.5), (x2 + arrow_size, y2 - arrow_size * 1.5)], fill=color)
        elif x2 > x1: # rightward
            draw.polygon([(x2, y2), (x2 - arrow_size * 1.5, y2 - arrow_size), (x2 - arrow_size * 1.5, y2 + arrow_size)], fill=color)
        elif x2 < x1: # leftward
            draw.polygon([(x2, y2), (x2 + arrow_size * 1.5, y2 - arrow_size), (x2 + arrow_size * 1.5, y2 + arrow_size)], fill=color)

    # Title Banner
    draw.rectangle([0, 0, width, 50], fill="#0f172a")
    draw.text((width // 2, 25), "OmniLife: Hybrid GraphRAG & Cognitive Twin Architecture Pipeline", fill="#ffffff", font=font_title, anchor="mm")

    boxes = [
        # 1. User Interaction
        {"id": "input", "xy": (250, 75, 750, 145), "bg": "#fef3c7", "border": "#d97706", "title": "User Interaction & Goal Input", "sub": "Voice (Web Speech API) / Text Prompt / Document Upload"},
        # 2. Frontend Layer
        {"id": "ui", "xy": (250, 185, 750, 255), "bg": "#dbeafe", "border": "#2563eb", "title": "Next.js 14 Interactive UI Layer", "sub": "State Management (Zustand), Twin Mode Selector (Mentor / Clone)"},
        # 3. Decision: Intent Validation & Classification
        {"id": "decision", "type": "diamond", "center": (500, 340), "w": 260, "h": 90, "bg": "#1e293b", "border": "#0f172a", "title": "Intent Analysis &\nAction Classifier"},
        # 4a. Left Branch: Direct Action Execution
        {"id": "action", "xy": (60, 430, 420, 505), "bg": "#f3e8ff", "border": "#9333ea", "title": "Deterministic Action Service", "sub": "CRUD on Goals, Projects, Skills & Graph Nodes"},
        # 4b. Right Branch: Cognitive Query / Hybrid Retrieval
        {"id": "query", "xy": (580, 430, 940, 505), "bg": "#ccfbf1", "border": "#0d9488", "title": "Hybrid GraphRAG Retrieval Engine", "sub": "User-Scoped Vector & Cypher Subgraph Retrieval"},
        # 5. Dual Store Retreival
        {"id": "chroma", "xy": (580, 555, 740, 645), "bg": "#e0f2fe", "border": "#0284c7", "title": "ChromaDB", "sub": "Semantic Vectors\n(all-MiniLM-L6-v2)"},
        {"id": "neo4j", "xy": (780, 555, 940, 645), "bg": "#e0f2fe", "border": "#0284c7", "title": "Neo4j Graph", "sub": "1-2 Hop Cypher\nRelational Traversal"},
        # 6. Context Fusion & Augmentation
        {"id": "fusion", "xy": (300, 700, 850, 775), "bg": "#fee2e2", "border": "#dc2626", "title": "Context Fusion & Prompt Engineering Engine", "sub": "Hybrid Score Reranking + Personality Framing (Mentor vs Clone)"},
        # 7. Local AI Inference
        {"id": "llm", "xy": (300, 825, 850, 905), "bg": "#ecfdf5", "border": "#059669", "title": "Local Ollama Inference Engine", "sub": "Llama 3.2 (3B/8B Quantized) - 100% Local & Zero Cloud"},
        # 8. Streaming Response Pipeline
        {"id": "stream", "xy": (300, 955, 850, 1025), "bg": "#f1f5f9", "border": "#475569", "title": "SSE Async Stream & Citations", "sub": "Server-Sent Events delta stream with grounded memory sources"},
        # 9. UI Visualization & Graph Synchronization
        {"id": "render", "xy": (250, 1075, 750, 1150), "bg": "#dbeafe", "border": "#2563eb", "title": "Dual-Theme Visual & Voice Synthesis", "sub": "React Force Graph update, Markdown parser, SpeechSynthesis"},
        # 10. Memory Consolidation Loop
        {"id": "persist", "xy": (250, 1200, 750, 1270), "bg": "#fef3c7", "border": "#d97706", "title": "Episodic Memory Persistence Loop", "sub": "Automated reflection log, streak tracking & graph mutation"}
    ]

    # Draw boxes
    for b in boxes:
        if b.get("type") == "diamond":
            cx, cy = b["center"]
            w, h = b["w"] / 2, b["h"] / 2
            draw.polygon([(cx, cy - h), (cx + w, cy), (cx, cy + h), (cx - w, cy)], fill=b["bg"], outline=b["border"])
            lines = b["title"].split("\n")
            if len(lines) == 1:
                draw.text((cx, cy), lines[0], fill="#ffffff", font=font_box_title, anchor="mm")
            else:
                draw.text((cx, cy - 10), lines[0], fill="#ffffff", font=font_box_title, anchor="mm")
                draw.text((cx, cy + 12), lines[1], fill="#ffffff", font=font_box_sub, anchor="mm")
        else:
            draw_rounded_box(b["xy"], fill=b["bg"], outline=b["border"], radius=10, width=2)
            x1, y1, x2, y2 = b["xy"]
            cx = (x1 + x2) // 2
            draw.text((cx, y1 + 24), b["title"], fill="#0f172a", font=font_box_title, anchor="mm")
            lines = b["sub"].split("\n")
            if len(lines) == 1:
                draw.text((cx, y1 + 50), b["sub"], fill="#475569", font=font_box_sub, anchor="mm")
            else:
                draw.text((cx, y1 + 46), lines[0], fill="#475569", font=font_box_sub, anchor="mm")
                draw.text((cx, y1 + 64), lines[1], fill="#475569", font=font_box_sub, anchor="mm")

    # Draw connecting arrows
    # input -> ui
    draw_arrow((500, 145), (500, 185))
    # ui -> decision
    draw_arrow((500, 255), (500, 295))

    # decision -> action (Deterministic)
    draw_arrow((370, 340), (240, 340))
    draw_arrow((240, 340), (240, 430))
    draw.text((295, 325), "Direct Action", fill="#7e22ce", font=font_label, anchor="mm")

    # decision -> query (Cognitive Query)
    draw_arrow((630, 340), (760, 340))
    draw_arrow((760, 340), (760, 430))
    draw.text((700, 325), "Cognitive Query", fill="#0f766e", font=font_label, anchor="mm")

    # query -> chroma & neo4j
    draw_arrow((660, 505), (660, 555))
    draw_arrow((860, 505), (860, 555))

    # chroma & neo4j -> fusion
    draw_arrow((660, 645), (660, 700))
    draw_arrow((860, 645), (750, 700))

    # action -> persist directly or render
    draw_arrow((240, 505), (240, 1110))
    draw_arrow((240, 1110), (250, 1110))

    # fusion -> llm
    draw_arrow((575, 775), (575, 825))
    # llm -> stream
    draw_arrow((575, 905), (575, 955))
    # stream -> render
    draw_arrow((575, 1025), (575, 1075))
    # render -> persist
    draw_arrow((500, 1150), (500, 1200))

    # persist -> feedback loop up to UI
    draw.line([(500, 1270), (500, 1310)], fill="#94a3b8", width=2)
    draw.line([(500, 1310), (970, 1310)], fill="#94a3b8", width=2)
    draw.line([(970, 1310), (970, 220)], fill="#94a3b8", width=2)
    draw_arrow((970, 220), (750, 220), color="#94a3b8", width=2)
    draw.text((860, 1295), "Continuous Life Feedback Loop", fill="#64748b", font=font_label, anchor="mm")

    img.save(output_path, dpi=(300, 300))
    print(f"Flowchart saved successfully to {output_path}")

if __name__ == "__main__":
    generate_flowchart()
