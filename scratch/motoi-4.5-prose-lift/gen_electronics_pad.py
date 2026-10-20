#!/usr/bin/env python3
"""Electronics padding to reach ~300."""

import json
from pathlib import Path

OUT = Path.home() / ".forge/corpus/motoi-v7-partial/prose-lift-electronics-pad.jsonl"

def emit(user, motoi, source_file, source_line, sub_shape, kind="electronics"):
    return {
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": motoi},
        ],
        "_meta": {
            "_source_file": source_file,
            "_source_lineno": source_line,
            "_kind": kind,
            "_bucket": "electronics-shop",
            "_provenance": f"book:{source_file}#L{source_line}",
            "_reshape_from": "motoi-4.0-v6",
            "_reshape_by": "ada-4.5-prose-lift-2026-07-19",
            "_authored_by": "ada",
            "_authored_when": "2026-07-19",
            "_sub_shape": sub_shape,
        },
    }

pairs = []

# ---- Common troubleshooting dialogs
troubleshoot = [
    ("my LED won't light up", "First: is it in the right way? LEDs are polarized — long lead to positive, short lead to ground. Then: is there current-limiting resistor? Then: is power actually on the rail?", "book-of-craft/03-the-breadboard.book.slatl", 100, "troubleshoot"),
    ("my LED is very dim", "Current-limiting resistor too big, or voltage too low, or LED just isn't very bright for that model. Try a smaller resistor within safe range.", "book-of-craft/03-the-breadboard.book.slatl", 60, "troubleshoot"),
    ("my LED blew up", "Too much current. Missing or wrong current-limiting resistor. Reverse voltage over its limit. Replace and recompute the resistor.", "book-of-craft/03-the-breadboard.book.slatl", 60, "troubleshoot"),
    ("my chip is getting hot", "Not always bad — some regulators are supposed to run warm. If too hot to touch: excess current, wrong voltage, missing bypass caps, or damaged part.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 90, "troubleshoot"),
    ("my chip smells burnt", "Turn off the power. Something's already gone. Check polarity, voltage, current-limiting. Replace the chip. Try again slowly.", "book-of-craft/07-safety-around-mains.book.slatl", 33, "troubleshoot"),
    ("my breadboard circuit works when I push on it", "Loose contact somewhere. A wire not fully seated or a worn clip. Trace with continuity mode.", "book-of-craft/03-the-breadboard.book.slatl", 92, "troubleshoot"),
    ("my measurements are noisy", "Check ground continuity first. Then bypass caps near active chips. Then shielding on long wires. Ground almost always the first culprit.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 100, "troubleshoot"),
    ("my transistor gets very hot", "Biased wrong, running out of spec, or missing a heatsink for its power level. Recompute the operating point.", "book-of-craft/04-the-datasheet.book.slatl", 5, "troubleshoot"),
    ("nothing works when i power it up", "Verify power is actually reaching the rails. Common: power supply not on, wrong voltage, wire not connected. Meter checks first.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 88, "troubleshoot"),
    ("my microcontroller keeps resetting", "Insufficient bypass capacitance, brown-out from a load transient, or watchdog timer. Add bypass caps first.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 90, "troubleshoot"),
    ("my sensor gives random values", "Noisy analog input? Try averaging in software. Check ground. Shield the wires. Add a small cap on the sensor input.", "book-of-craft/04-the-datasheet.book.slatl", 5, "troubleshoot"),
    ("my sound is buzzy", "Ground loop, or insufficient supply filtering, or interference. Common on audio circuits. Star ground, better bypass, shielded audio wire.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 45, "troubleshoot"),
    ("my motor won't spin", "Not enough voltage, not enough current, no ground path, or motor's stuck mechanically. Meter to check what's actually reaching the motor.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "troubleshoot"),
    ("my motor spins wrong direction", "Swap the two motor leads. Or reverse the H-bridge inputs if you have one.", "book-of-craft/04-the-datasheet.book.slatl", 5, "troubleshoot"),
    ("my capacitor exploded", "Reverse polarity on an electrolytic. Or overvoltage. Both bad. Replace with correct part, check polarity marks before soldering next time.", "book-of-craft/07-safety-around-mains.book.slatl", 33, "troubleshoot"),
    ("smoke came out of my board", "Cut power immediately. Identify the burnt component. Common causes: reverse polarity, short circuit, wrong voltage. Repair or replace.", "book-of-craft/07-safety-around-mains.book.slatl", 33, "troubleshoot"),
    ("my logic level shifter isn't shifting", "Check that both sides have their appropriate supplies. Enable pin? Direction pin? Datasheet has the truth.", "book-of-craft/04-the-datasheet.book.slatl", 5, "troubleshoot"),
    ("i can't get my crystal to oscillate", "Load capacitors — every crystal wants specific values, usually two small caps to ground from each terminal. Datasheet spec.", "book-of-craft/04-the-datasheet.book.slatl", 5, "troubleshoot"),
    ("my LCD shows garbage", "Timing usually. Check clock, check contrast pot, check that the initialization sequence completes. Datasheet has the boot dance.", "book-of-craft/04-the-datasheet.book.slatl", 5, "troubleshoot"),
    ("my button doesn't work reliably", "Contact bounce. When you press it, contacts chatter for a few milliseconds. Debounce in software (ignore for 20ms) or with a small RC filter.", "book-of-craft/04-the-datasheet.book.slatl", 5, "troubleshoot"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in troubleshoot])

# ---- Basic components deeper
comp_more = [
    ("what does a capacitor smooth", "Voltage. A cap on a supply rail absorbs sudden dips and rises, keeping the voltage steadier. Bulk caps at the supply; small caps at each chip.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "components"),
    ("what capacitance for bypass", "0.1μF ceramic is standard for a bypass cap on a digital chip. Sometimes a 1μF or 10μF nearby for bulk storage. Datasheet may specify.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 76, "components"),
    ("what's an electrolytic cap", "A polarized capacitor with high capacitance for its size. Used for bulk storage. Has a + and - marking — get it right or it fails loudly.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "components"),
    ("what's a ceramic cap", "Non-polarized, small values (pF to μF), good high-frequency response. Bypass, filter, timing. The workhorse cap.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "components"),
    ("what's a tantalum cap", "High capacitance, small size, polarized. Reliable but fails as a short if abused — will smoke or catch fire. Modern designs often prefer ceramic multilayer.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "components"),
    ("what's a supercapacitor", "Very high capacitance (farads, not microfarads). Low voltage. Can hold charge to keep a real-time clock running when main power is off. Slow to charge.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "components"),
    ("what's ESR", "Equivalent series resistance. Real capacitors have a small internal resistance in series with the ideal capacitance. Higher ESR = worse for smoothing.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "components"),
    ("what's inductance", "Property that resists changes in current. Measured in henries. Inductors store energy in magnetic fields. Wires have inductance too — small but nonzero.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 5, "components"),
    ("what's a color code on resistors", "Bands specify value. Four bands: two digits, multiplier, tolerance. Five bands: three digits, multiplier, tolerance. Chart lookup or app.", "book-of-craft/03-the-breadboard.book.slatl", 5, "components"),
    ("what's a resistor tolerance", "How close to nominal value it actually is. ±1%, ±5%, ±10%. Precision circuits want 1%; hobby circuits usually fine with 5%.", "book-of-craft/03-the-breadboard.book.slatl", 5, "components"),
    ("what's resistor wattage", "Max power the resistor can dissipate. 1/4 watt is common for through-hole. Big loads want bigger resistors.", "book-of-craft/03-the-breadboard.book.slatl", 5, "components"),
    ("what's a potentiometer", "A variable resistor. Three-terminal — two ends and a wiper. Turn the shaft, the wiper moves. Volume knobs, threshold adjustments.", "book-of-craft/03-the-breadboard.book.slatl", 5, "components"),
    ("what's a trimpot", "A small potentiometer meant for calibration, not user adjustment. Screwdriver-adjustable. Set once, forget.", "book-of-craft/03-the-breadboard.book.slatl", 5, "components"),
    ("what's a rheostat", "A two-terminal variable resistor — the wiper is one terminal. Simpler than a potentiometer for straight resistance variation.", "book-of-craft/03-the-breadboard.book.slatl", 5, "components"),
    ("what's a mosfet", "Metal-oxide-semiconductor field-effect transistor. Voltage-controlled switch, very low on-resistance. Common in power switching, logic gates.", "book-of-craft/04-the-datasheet.book.slatl", 5, "components"),
    ("what's a bjt", "Bipolar junction transistor. Current-controlled — base current controls collector current. NPN and PNP variants. Classic small-signal amplifier or switch.", "book-of-craft/04-the-datasheet.book.slatl", 5, "components"),
    ("what's a schottky diode", "Fast-switching, low-forward-voltage diode. Around 0.3V drop vs 0.7V for silicon. Used in switching supplies and RF.", "book-of-craft/02-the-multimeter.book.slatl", 78, "components"),
    ("what's a TVS diode", "Transient voltage suppressor. A diode that clamps voltage spikes. Protects against surges. Common on I/O ports.", "book-of-craft/07-safety-around-mains.book.slatl", 15, "components"),
    ("what's an inductor", "A coil that stores energy in a magnetic field. Resists changes in current. Used in filters, transformers, DC-DC converters.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "components"),
    ("what's a ferrite bead", "A tiny inductor that specifically blocks high frequencies. Used to suppress EMI on power and signal lines.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 15, "components"),
    ("what's a magnetics", "General term for inductors, transformers, and chokes. Coils of wire around cores. Storing and transferring energy magnetically.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "components"),
    ("what's a transformer", "Two or more coils on a shared core. AC in the primary induces AC in the secondary. Steps voltage up or down. Isolates.", "book-of-craft/07-safety-around-mains.book.slatl", 41, "components"),
    ("what's an isolation transformer again", "1:1 transformer that isolates the secondary side from mains — no direct connection. Reduces shock risk for service work.", "book-of-craft/07-safety-around-mains.book.slatl", 41, "components"),
    ("what's a heat sink", "A finned piece of aluminum bolted to a hot part to spread the heat and let it flow into the air. TO-220 regulators often need one under load.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "components"),
    ("what's thermal paste", "Compound between a component and its heat sink to fill microscopic gaps and improve heat transfer. Silicone or metal-oxide based.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "components"),
    ("what's a fan for", "Moving air across a heat sink to shed heat faster. Small computer fans in enclosures. CPU coolers under load.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "components"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in comp_more])

# ---- Test equipment
test = [
    ("what's an oscilloscope for", "Seeing waveforms — voltage over time. Debug timing, spot noise, measure amplitude, check clock quality. Essential above DC.", "book-of-craft/02-the-multimeter.book.slatl", 5, "test"),
    ("what's a scope probe", "Cable that connects a scope to a signal. Usually 10:1 attenuation to protect the scope input and reduce loading. Has a small trimmer to calibrate.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "test"),
    ("what's a bench power supply", "Adjustable-voltage, adjustable-current-limit source for the bench. Set voltage and current limit — the current limit protects your circuit from surprises.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "test"),
    ("what's current limiting on a supply", "The supply drops voltage as needed to keep current at the set max. Protects everything downstream if you short something.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "test"),
    ("what's a function generator", "Produces test signals — sine, square, triangle, sawtooth — at controllable frequency and amplitude. For testing circuit responses.", "book-of-craft/02-the-multimeter.book.slatl", 5, "test"),
    ("what's a spectrum analyzer", "Shows a signal's frequency content — which frequencies are present and at what strength. FFT-based cheap ones; expensive dedicated ones for RF work.", "book-of-craft/02-the-multimeter.book.slatl", 5, "test"),
    ("what's an ESR meter", "Meter that measures the equivalent series resistance of a capacitor. High ESR = bad cap even if capacitance reads right. Useful for repair.", "book-of-craft/02-the-multimeter.book.slatl", 5, "test"),
    ("what's a bench meter", "A high-precision multimeter. More digits, better accuracy, sometimes with a display for logging. Slower than handheld — sample rate is lower.", "book-of-craft/02-the-multimeter.book.slatl", 5, "test"),
    ("what's a network analyzer", "Instrument that measures RF component behavior across frequencies — S-parameters. Expensive, specialized. Bench design work for antennas, filters.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "test"),
    ("what's a curve tracer", "Instrument that plots a component's I-V curve. See how a diode or transistor actually behaves. Not usually needed for hobby.", "book-of-craft/02-the-multimeter.book.slatl", 5, "test"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in test])

# ---- More assembly / working practices
practice = [
    ("what's an ESD mat", "A conductive mat that provides a low-impedance path to ground. Wear a wristband strapped to it. Prevents static from zapping delicate chips.", "book-of-craft/04-the-datasheet.book.slatl", 73, "practice"),
    ("what's a wrist strap", "Grounding strap for the person — conductive band around your wrist, wire to ground. Same purpose as the mat.", "book-of-craft/04-the-datasheet.book.slatl", 73, "practice"),
    ("what's a magnifying lamp", "Bench light with a magnifier built in. Essential for SMD soldering and fine inspection. Hurts less than squinting.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 40, "practice"),
    ("what's a fume extractor", "Small fan with a filter that pulls solder smoke away from your face. Worth having if you solder often. Cheap ones work fine.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 121, "practice"),
    ("what's a component tester", "Small device that identifies components — resistor value, capacitance, transistor type. Handy for parts with worn markings.", "book-of-craft/04-the-datasheet.book.slatl", 5, "practice"),
    ("what's a wire stripper", "Tool with sized notches for stripping insulation off wires. One per common gauge. Gets you the length right without nicking the copper.", "book-of-craft/03-the-breadboard.book.slatl", 47, "practice"),
    ("what's a crimper", "Tool for pressing a connector barrel onto a wire. Ratcheting versions ensure the crimp is tight. Correct crimp is a proper joint without solder.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "practice"),
    ("what's heat shrink tubing", "Plastic tube that shrinks when heated. Slide over a solder joint, heat with a hair dryer or heat gun, insulates and protects.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 5, "practice"),
    ("what's an anti-static bag", "The pink or silver bag components ship in. Prevents ESD damage in storage. Save them for storing sensitive parts.", "book-of-craft/04-the-datasheet.book.slatl", 73, "practice"),
    ("what's a hakko iron", "Popular brand of soldering irons. FX-888D is a common bench model — temperature-controlled, reliable, reasonably priced.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 51, "practice"),
    ("what's a weller iron", "Another well-known iron brand. Old-school. Some hobbyists swear by the old WES51 or newer WE1010.", "book-of-craft/01-solder-iron-and-flux.book.slatl", 51, "practice"),
    ("what's a lab notebook", "Where you record what you built, what you measured, what you changed. Future-you will thank you. Bench engineering wants written history.", "book-of-craft/08-what-motoi-can-and-cannot-say-about-hardware.book.slatl", 20, "practice"),
    ("what's a bill of materials", "The list of parts a design needs. BOM. What you order from Digikey. Include quantities, part numbers, values.", "book-of-craft/03-the-breadboard.book.slatl", 106, "practice"),
    ("what's a schematic capture tool", "Software for drawing schematics. KiCad's eeschema, Eagle, Altium. Turn ideas into circuit diagrams.", "book-of-craft/03-the-breadboard.book.slatl", 106, "practice"),
    ("what's simulation software", "SPICE and derivatives simulate a circuit's behavior before you build it. LTspice is free and popular. Verify amplitude, frequency response, timing.", "book-of-craft/03-the-breadboard.book.slatl", 106, "practice"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in practice])

# ---- More scope-honest pairs
scope_more = [
    ("what should i buy first for electronics", "Not my place to give specific brands. But: temperature-controlled iron, digital multimeter, wire strippers, some resistors and LEDs, a breadboard. Start there.", "book-of-craft/08-what-motoi-can-and-cannot-say-about-hardware.book.slatl", 20, "scope"),
    ("is this circuit safe", "I can't tell without seeing it. Describe it in words and I'll flag concerns. Mains-adjacent? Please get a real person to look.", "book-of-craft/08-what-motoi-can-and-cannot-say-about-hardware.book.slatl", 47, "scope"),
    ("can you build this project with me", "The design and code parts, yes. The physical assembly is you. But I'll ride along.", "book-of-craft/08-what-motoi-can-and-cannot-say-about-hardware.book.slatl", 47, "scope"),
    ("what's the best breadboard", "I don't have opinions on specific products. Any name-brand board (BusBoard, Jameco) will do fine. Cheap unbranded ones sometimes have poor clips.", "book-of-craft/08-what-motoi-can-and-cannot-say-about-hardware.book.slatl", 40, "scope"),
    ("can you troubleshoot my broken toaster", "I'd rather you unplug it and either fix simple mechanical issues yourself or take it to someone who does appliance repair. Mains-inside-a-metal-box isn't my scope.", "book-of-craft/07-safety-around-mains.book.slatl", 41, "scope"),
    ("i want to power a project from a wall outlet", "Buy a UL-listed wall wart that outputs the DC voltage you need. Don't build your own AC-to-DC converter as a beginner project.", "book-of-craft/07-safety-around-mains.book.slatl", 68, "scope"),
    ("how do i wire a light switch", "Please call an electrician. That's inside my no-mains rule.", "book-of-craft/07-safety-around-mains.book.slatl", 41, "scope"),
    ("how do i replace an outlet", "Same answer — electrician. Even the simplest-looking mains work can go wrong badly. Not what I'm for.", "book-of-craft/07-safety-around-mains.book.slatl", 41, "scope"),
    ("can we discuss antenna design", "Yes, at concept level. Actual optimization needs a network analyzer and RF experience. I know the shape of it.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "scope"),
    ("do you know esp32", "I know its shape — 3.3V, WiFi, Bluetooth, dual-core, big for a microcontroller. Actual code I'd rather leave to a bigger model. I write Motoi.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 20, "scope"),
    ("do you know raspberry pi", "Yeah, general shape. Real Linux, GPIO pins, HDMI, USB. For the specifics of pi setup, ask something bigger — I know the outline.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 20, "scope"),
    ("what's a good 3d printer", "Not my area. Ask a maker community. I can talk about the electronics inside if that helps.", "book-of-craft/08-what-motoi-can-and-cannot-say-about-hardware.book.slatl", 40, "scope"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in scope_more])

# ---- More depth  in ohms law, math of circuits
math_more = [
    ("what's ohms law example", "V = I × R. If R = 100 Ω and I = 0.05 A, then V = 5. That's the drop across the resistor when 50 mA flows.", "book-of-craft/02-the-multimeter.book.slatl", 138, "math"),
    ("how do i pick a current limiting resistor for an LED", "R = (Vsupply - Vf_LED) / I. For a red LED at 20mA from 5V: R = (5 - 2)/0.02 = 150 Ω. Round up to 220Ω for safety.", "book-of-craft/03-the-breadboard.book.slatl", 60, "math"),
    ("what's power in watts", "P = V × I. Voltage times current. Or P = I² × R. Or P = V² / R. Same relationship, algebra rearranged.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 5, "math"),
    ("how do i pick a resistor wattage", "Compute power dissipation: V² / R across the resistor. Buy one rated for at least 2× that. Common values: 1/4W, 1/2W, 1W, 5W.", "book-of-craft/03-the-breadboard.book.slatl", 5, "math"),
    ("what's kirchoffs voltage law", "Sum of voltages around any closed loop is zero. What goes up must come down. Foundation of circuit analysis.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 5, "math"),
    ("what's kirchoffs current law", "Sum of currents into any node equals sum of currents out. Charge is conserved. Foundation of node analysis.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 11, "math"),
    ("how do i compute parallel resistance", "1/Rtotal = 1/R1 + 1/R2 + ... For two: R1 × R2 / (R1 + R2). Two equal resistors in parallel: half of one. Convenient.", "book-of-craft/03-the-breadboard.book.slatl", 5, "math"),
    ("how do i compute series resistance", "Just add them. Rtotal = R1 + R2 + R3. Same current flows through each; voltages add.", "book-of-craft/03-the-breadboard.book.slatl", 5, "math"),
    ("what's an RC time constant", "τ = R × C. The time for a capacitor to charge (or discharge) to about 63% through a resistor. Full charge takes about 5τ.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 62, "math"),
    ("what's cutoff frequency", "For an RC filter: f = 1 / (2π R C). The frequency at which the filter attenuates the signal by half power (-3dB).", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 24, "math"),
    ("what's decibels", "A log scale. 3dB = doubling of power. 10dB = 10x. Handy for large dynamic ranges.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 15, "math"),
    ("what's impedance mathematically", "Z = R + jX. Resistance plus imaginary reactance. In AC circuits, impedance replaces resistance. Vector math, but consistent.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "math"),
    ("what's reactance", "The AC equivalent of resistance for reactive components. Capacitive reactance decreases with frequency; inductive increases. Xc = 1/(2πfC), XL = 2πfL.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "math"),
    ("what's a q factor", "Quality factor of a resonant circuit. High Q = sharp resonance, narrow bandwidth. Low Q = broad response. Comes up in filters and antennas.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "math"),
    ("what's efficiency in a power supply", "Output power / input power. Linear regulators can be very low (a 12→5V linear at 100mA is about 42% efficient). Switchers push 85-95%.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 32, "math"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in math_more])

# ---- Assembly / mechanical
mech = [
    ("what's a standoff", "Small pillar that holds a PCB above a chassis. Threads on both ends. Keeps the board from shorting to the case and makes air flow underneath.", "book-of-craft/03-the-breadboard.book.slatl", 106, "mech"),
    ("what's a chassis", "The enclosure that holds a circuit. Metal or plastic. Metal helps EMI shielding but needs proper grounding.", "book-of-craft/05-power-supplies-rails-and-ground.book.slatl", 45, "mech"),
    ("what's a rack unit", "Standard 19-inch rack equipment is measured in U — one rack unit is 1.75 inches tall. 1U, 2U, 3U enclosures.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "mech"),
    ("what's an enclosure rating", "IP-rating tells you dust and water resistance. IP54 is protected against dust and splashes. IP68 is dust-tight and submersible.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "mech"),
    ("what's strain relief on a project", "How you keep pulling on external cables from stressing internal solder joints. Grommet, clamp, or knot inside the enclosure.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 15, "mech"),
    ("what's a panel-mount connector", "A connector designed to be installed in a case wall. Robust flanges, secure to the panel with nuts or screws. External access to internal boards.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "mech"),
    ("what's a JTAG header", "Small connector on a board that a JTAG debugger plugs into. 10 pin, 14 pin, 20 pin depending on the family.", "book-of-craft/04-the-datasheet.book.slatl", 5, "mech"),
    ("what's a debug header", "A small connector reserved for connecting a debugger. Different chips have different pinouts. Often 10-pin or 6-pin.", "book-of-craft/04-the-datasheet.book.slatl", 5, "mech"),
    ("what's a ribbon cable", "Flat multi-conductor cable, side-by-side wires. Easy to attach via IDC connectors. Common inside PCs for drives.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "mech"),
    ("what's IDC", "Insulation-displacement connector. Ribbon cable pushed onto a header — sharp blades cut through insulation to make contact. Fast to assemble.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "mech"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in mech])

# ---- More RF and comms
rf = [
    ("what's a common radio band", "AM broadcast: 530-1710 kHz. FM: 88-108 MHz. WiFi: 2.4 GHz and 5 GHz. Bluetooth: 2.4 GHz. Different chunks of the spectrum for different uses.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's ham radio", "Amateur radio. Licensed operators transmit on allocated bands. Community, emergency comms, hobby. Requires a test in most countries.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's morse code", "A pattern of dots and dashes for each letter. Used since telegraph days. Still used in ham radio because it goes through when everything else fails.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's an antenna", "A conductor sized to efficiently radiate or receive electromagnetic waves at a target frequency. Length matters — usually a fraction of the wavelength.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's a dipole antenna", "Two conductors, each a quarter wavelength, fed at the center. Classic simple antenna. Radiates broadside.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's SWR", "Standing wave ratio. How well an antenna is matched to its feedline. 1.0 is perfect; higher means reflections. Above 2 is worth investigating.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's modulation", "Encoding information onto a carrier wave. AM varies amplitude. FM varies frequency. Digital modulation varies both in structured ways.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's software defined radio", "A radio where most of the signal processing happens in software instead of dedicated circuits. RTL-SDR is a cheap entry point.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 48, "rf"),
    ("what's SPI vs I2C", "SPI: four wires, faster, master-slave. I2C: two wires, slower, multi-device shared bus with addresses. Different tradeoffs.", "book-of-craft/04-the-datasheet.book.slatl", 5, "protocol"),
    ("what's CAN bus", "Automotive networking protocol. Differential pair, robust to noise, prioritized messages. In every modern car.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 55, "protocol"),
    ("what's RS-232", "Old serial standard. ±12V signaling, one-to-one, up to modest distances. Now largely replaced by USB serial but still used in industrial equipment.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "protocol"),
    ("what's RS-485", "Differential serial standard. Multi-drop bus. Long distances (kilometer plus). Robust to noise. Common in industrial control.", "book-of-craft/06-cables-connectors-impedance.book.slatl", 32, "protocol"),
]
pairs.extend([emit(u, m, s, l, sh) for (u, m, s, l, sh) in rf])

with open(OUT, "w") as f:
    for p in pairs:
        f.write(json.dumps(p) + "\n")

print(f"wrote {len(pairs)} electronics pad pairs to {OUT}")
