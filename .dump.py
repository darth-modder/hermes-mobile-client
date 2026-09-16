"""M15 r12 device helper: dump the accessibility tree and report clickable
nodes with their dp sizes. Density 420 => 2.625 px per dp."""
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ADB = "D:/Software/Android-SDK/platform-tools/adb.exe"
DENSITY = 420.0 / 160.0  # 2.625

BOUNDS = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")


def dump(dest):
    subprocess.run([ADB, "shell", "uiautomator", "dump", "/sdcard/ui.xml"],
                   capture_output=True, timeout=20)
    subprocess.run([ADB, "pull", "/sdcard/ui.xml", dest],
                   capture_output=True, timeout=20)
    return dest


def nodes(path, clickable_only=True):
    out = []
    for node in ET.parse(path).getroot().iter("node"):
        if clickable_only and node.get("clickable") != "true":
            continue
        m = BOUNDS.match(node.get("bounds", ""))
        if not m:
            continue
        x1, y1, x2, y2 = map(int, m.groups())
        w, h = x2 - x1, y2 - y1
        out.append({
            "cls": (node.get("class") or "").split(".")[-1],
            "text": node.get("text") or "",
            "desc": node.get("content-desc") or "",
            "px": (x1, y1, x2, y2),
            "wdp": round(w / DENSITY, 1),
            "hdp": round(h / DENSITY, 1),
            "centre": ((x1 + x2) // 2, (y1 + y2) // 2),
        })
    return out


def report(path, title=""):
    lines = []
    if title:
        lines.append(f"=== {title} ===")
    under = 0
    for n in nodes(path):
        label = n["text"] or n["desc"] or n["cls"]
        flag = ""
        if n["hdp"] < 48 or n["wdp"] < 48:
            flag = "   <<< UNDER 48dp"
            under += 1
        lines.append(
            f"CLICK [{n['px'][0]},{n['px'][1]}][{n['px'][2]},{n['px'][3]}] "
            f"{n['wdp']}x{n['hdp']}dp centre={n['centre']} "
            f"{n['cls']:<12} {label!r}{flag}")
    lines.append(f"-- {len(nodes(path))} clickable nodes, {under} under 48dp --")
    return "\n".join(lines)


if __name__ == "__main__":
    dest = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else ""
    dump(dest)
    print(report(dest, title))
