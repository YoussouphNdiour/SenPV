"""
Schematic graph service — generates electrical single-line diagrams
from panel layout configurations using networkx.

Nodes represent electrical components (panels, breakers, inverter, etc.)
and edges represent cable connections with calculated sections.
"""

from __future__ import annotations

import math
from typing import Any

import networkx as nx

# ---------------------------------------------------------------------------
# Standard ratings for breakers and cable sections
# ---------------------------------------------------------------------------
STANDARD_BREAKER_RATINGS = [6, 10, 16, 20, 25, 32, 40, 50, 63]
STANDARD_CABLE_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50]
COPPER_RESISTIVITY = 0.0225  # ohm.mm²/m


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _next_standard(value: float, standards: list[int | float]) -> int | float:
    """Return the first standard value >= the given value."""
    for s in standards:
        if s >= value:
            return s
    return standards[-1]


def _parse_mppt_range(spec_value: Any) -> tuple[float, float]:
    """Parse mppt_voltage_range_v which can be a string '80-550' or a list [80, 550]."""
    if isinstance(spec_value, str):
        parts = spec_value.split("-")
        return float(parts[0].strip()), float(parts[1].strip())
    if isinstance(spec_value, (list, tuple)) and len(spec_value) == 2:
        return float(spec_value[0]), float(spec_value[1])
    raise ValueError(f"Cannot parse MPPT voltage range: {spec_value}")


def calc_dc_breaker_rating(panel_specs: dict, panel_layout: dict) -> int:
    """Calculate DC breaker rating based on Isc x 1.25, rounded up to standard."""
    min_rating = panel_specs["isc_a"] * 1.25
    return _next_standard(min_rating, STANDARD_BREAKER_RATINGS)


def calc_ac_breaker_rating(inverter_specs: dict) -> int:
    """Calculate AC breaker rating based on rated AC current x 1.25, rounded up to standard."""
    min_rating = inverter_specs["rated_ac_current_a"] * 1.25
    return _next_standard(min_rating, STANDARD_BREAKER_RATINGS)


def calc_cable_section(
    current_a: float,
    length_m: float = 10,
    voltage_drop_pct: float = 3,
    voltage_ref: float = 230,
) -> float:
    """Calculate minimum cable section for acceptable voltage drop, rounded up to standard."""
    if current_a <= 0 or voltage_ref <= 0:
        return STANDARD_CABLE_SECTIONS[0]
    section = (2 * COPPER_RESISTIVITY * length_m * current_a) / (
        voltage_drop_pct / 100 * voltage_ref
    )
    return _next_standard(section, STANDARD_CABLE_SECTIONS)


# ---------------------------------------------------------------------------
# Graph generation
# ---------------------------------------------------------------------------

def generate_schematic(
    panel_layout: dict,
    panel_specs: dict,
    inverter_specs: dict,
) -> nx.DiGraph:
    """
    Build a networkx DiGraph representing the single-line electrical diagram.

    Flow: panels -> string combiners -> dc_box -> dc_surge -> dc_breaker
          -> inverter -> ac_breaker -> ac_surge -> ac_box -> meter -> grid
    Ground connects to: inverter, dc_surge, ac_surge.
    """
    G = nx.DiGraph()

    num_strings = panel_layout["num_strings"]
    panels_per_string = panel_layout["panels_per_string"]

    # Pre-calculate ratings
    dc_breaker_rating = calc_dc_breaker_rating(panel_specs, panel_layout)
    ac_breaker_rating = calc_ac_breaker_rating(inverter_specs)

    # String-level electrical values
    string_voc = panel_specs["voc_v"] * panels_per_string
    string_vmp = panel_specs["vmp_v"] * panels_per_string
    string_isc = panel_specs["isc_a"]
    string_imp = panel_specs["imp_a"]

    # Cable sections
    dc_cable_section = calc_cable_section(
        string_isc, length_m=10, voltage_drop_pct=3, voltage_ref=string_vmp
    )
    ac_cable_section = calc_cable_section(
        inverter_specs["rated_ac_current_a"],
        length_m=10,
        voltage_drop_pct=3,
        voltage_ref=inverter_specs.get("rated_output_voltage_v", 230),
    )
    ground_cable_section = max(dc_cable_section, 6.0)  # min 6mm² for ground

    # ---- Create panel and string nodes ----
    for s in range(1, num_strings + 1):
        # Individual panel nodes
        for p in range(1, panels_per_string + 1):
            panel_id = f"panel_{s}_{p}"
            G.add_node(
                panel_id,
                node_type="panel",
                label=f"PV {s}.{p}",
                string=s,
                position_in_string=p,
                pmax_w=panel_specs["pmax_w"],
                voc_v=panel_specs["voc_v"],
                vmp_v=panel_specs["vmp_v"],
                isc_a=panel_specs["isc_a"],
                imp_a=panel_specs["imp_a"],
            )

        # String combiner node
        string_id = f"string_{s}"
        G.add_node(
            string_id,
            node_type="string",
            label=f"String {s}",
            string=s,
            num_panels=panels_per_string,
            voc_v=string_voc,
            vmp_v=string_vmp,
            isc_a=string_isc,
            imp_a=string_imp,
        )

        # Edges: panels -> string combiner (series connection)
        for p in range(1, panels_per_string + 1):
            panel_id = f"panel_{s}_{p}"
            if p < panels_per_string:
                # Series connection between panels
                next_panel_id = f"panel_{s}_{p + 1}"
                G.add_edge(
                    panel_id,
                    next_panel_id,
                    cable_type="dc",
                    section_mm2=dc_cable_section,
                    connection="series",
                )
            else:
                # Last panel connects to string combiner
                G.add_edge(
                    panel_id,
                    string_id,
                    cable_type="dc",
                    section_mm2=dc_cable_section,
                    connection="series",
                )

    # ---- DC side nodes ----
    total_current_dc = string_isc * num_strings

    G.add_node(
        "dc_box",
        node_type="dc_box",
        label="Coffret DC",
        num_strings=num_strings,
        total_voc_v=string_voc,
        total_isc_a=total_current_dc,
    )

    G.add_node(
        "dc_surge",
        node_type="dc_surge",
        label="Parafoudre DC",
        surge_type="Type 2",
        max_voltage_v=string_voc,
    )

    G.add_node(
        "dc_breaker",
        node_type="dc_breaker",
        label=f"Disj. DC {dc_breaker_rating}A",
        rating_a=dc_breaker_rating,
        poles=2,
        breaking_capacity_ka=10,
    )

    G.add_node(
        "inverter",
        node_type="inverter",
        label="Onduleur",
        rated_ac_power_kw=inverter_specs["rated_ac_power_kw"],
        max_pv_voltage_v=inverter_specs["max_pv_voltage_v"],
        num_mppt=inverter_specs["num_mppt"],
        strings_per_mppt=inverter_specs.get("strings_per_mppt", 1),
        max_input_current_a=inverter_specs["max_input_current_a"],
        rated_ac_current_a=inverter_specs["rated_ac_current_a"],
    )

    # ---- AC side nodes ----
    G.add_node(
        "ac_breaker",
        node_type="ac_breaker",
        label=f"Disj. AC {ac_breaker_rating}A",
        rating_a=ac_breaker_rating,
        poles=2,
        breaking_capacity_ka=6,
    )

    G.add_node(
        "ac_surge",
        node_type="ac_surge",
        label="Parafoudre AC",
        surge_type="Type 2",
        max_voltage_v=inverter_specs.get("rated_output_voltage_v", 230),
    )

    G.add_node(
        "ac_box",
        node_type="ac_box",
        label="Coffret AC",
        rated_current_a=inverter_specs["rated_ac_current_a"],
    )

    G.add_node(
        "meter",
        node_type="meter",
        label="Compteur bidirectionnel",
        meter_type="bidirectional",
    )

    G.add_node(
        "grid",
        node_type="grid",
        label="Réseau SENELEC",
        voltage_v=230,
        frequency_hz=50,
    )

    G.add_node(
        "ground",
        node_type="ground",
        label="Mise à la terre",
        resistance_ohm=10,
    )

    # ---- DC edges: strings -> dc_box -> dc_surge -> dc_breaker -> inverter ----
    for s in range(1, num_strings + 1):
        G.add_edge(
            f"string_{s}",
            "dc_box",
            cable_type="dc",
            section_mm2=dc_cable_section,
            connection="parallel",
        )

    G.add_edge(
        "dc_box",
        "dc_surge",
        cable_type="dc",
        section_mm2=dc_cable_section,
    )
    G.add_edge(
        "dc_surge",
        "dc_breaker",
        cable_type="dc",
        section_mm2=dc_cable_section,
    )
    G.add_edge(
        "dc_breaker",
        "inverter",
        cable_type="dc",
        section_mm2=dc_cable_section,
    )

    # ---- AC edges: inverter -> ac_breaker -> ac_surge -> ac_box -> meter -> grid ----
    G.add_edge(
        "inverter",
        "ac_breaker",
        cable_type="ac",
        section_mm2=ac_cable_section,
    )
    G.add_edge(
        "ac_breaker",
        "ac_surge",
        cable_type="ac",
        section_mm2=ac_cable_section,
    )
    G.add_edge(
        "ac_surge",
        "ac_box",
        cable_type="ac",
        section_mm2=ac_cable_section,
    )
    G.add_edge(
        "ac_box",
        "meter",
        cable_type="ac",
        section_mm2=ac_cable_section,
    )
    G.add_edge(
        "meter",
        "grid",
        cable_type="ac",
        section_mm2=ac_cable_section,
    )

    # ---- Ground connections ----
    G.add_edge(
        "inverter",
        "ground",
        cable_type="ground",
        section_mm2=ground_cable_section,
    )
    G.add_edge(
        "dc_surge",
        "ground",
        cable_type="ground",
        section_mm2=ground_cable_section,
    )
    G.add_edge(
        "ac_surge",
        "ground",
        cable_type="ground",
        section_mm2=ground_cable_section,
    )

    return G


# ---------------------------------------------------------------------------
# Electrical validation
# ---------------------------------------------------------------------------

def validate_electrical(
    G: nx.DiGraph,
    panel_specs: dict,
    inverter_specs: dict,
    panel_layout: dict,
) -> list[dict]:
    """
    Validate electrical constraints and return a list of issues.

    Each issue: {type: str, severity: 'critical'|'warning', message: str, nodes: list[str]|None}
    """
    issues: list[dict] = []

    num_strings = panel_layout["num_strings"]
    panels_per_string = panel_layout["panels_per_string"]

    string_voc = panel_specs["voc_v"] * panels_per_string
    string_vmp = panel_specs["vmp_v"] * panels_per_string
    string_isc = panel_specs["isc_a"]

    max_pv_voltage = inverter_specs["max_pv_voltage_v"]
    mppt_min, mppt_max = _parse_mppt_range(inverter_specs["mppt_voltage_range_v"])
    max_input_current = inverter_specs["max_input_current_a"]
    num_mppt = inverter_specs["num_mppt"]
    strings_per_mppt = inverter_specs.get("strings_per_mppt", 1)

    # 1. String Voc vs max PV voltage
    if string_voc > max_pv_voltage:
        string_nodes = [f"string_{s}" for s in range(1, num_strings + 1)]
        issues.append({
            "type": "overvoltage",
            "severity": "critical",
            "message": (
                f"Tension Voc string ({string_voc:.1f}V) dépasse la tension max "
                f"onduleur ({max_pv_voltage:.1f}V)"
            ),
            "nodes": string_nodes,
        })

    # 2. String Vmp within MPPT range
    if string_vmp < mppt_min or string_vmp > mppt_max:
        string_nodes = [f"string_{s}" for s in range(1, num_strings + 1)]
        issues.append({
            "type": "mppt_range",
            "severity": "warning",
            "message": (
                f"Tension Vmp string ({string_vmp:.1f}V) hors plage MPPT "
                f"({mppt_min:.0f}-{mppt_max:.0f}V)"
            ),
            "nodes": string_nodes,
        })

    # 3. String Isc vs max input current per MPPT
    if string_isc > max_input_current:
        issues.append({
            "type": "overcurrent_mppt",
            "severity": "critical",
            "message": (
                f"Courant Isc string ({string_isc:.2f}A) dépasse le courant max "
                f"entrée MPPT ({max_input_current:.2f}A)"
            ),
            "nodes": None,
        })

    # 4. Number of strings vs MPPT capacity
    max_strings = num_mppt * strings_per_mppt
    if num_strings > max_strings:
        issues.append({
            "type": "strings_exceeded",
            "severity": "critical",
            "message": (
                f"Nombre de strings ({num_strings}) dépasse la capacité onduleur "
                f"({num_mppt} MPPT x {strings_per_mppt} = {max_strings} strings max)"
            ),
            "nodes": ["inverter"],
        })

    # 5. Floating nodes (no edges at all)
    for node in G.nodes:
        if G.degree(node) == 0:
            issues.append({
                "type": "floating_node",
                "severity": "warning",
                "message": f"Noeud isolé détecté: {node}",
                "nodes": [node],
            })

    # 6. DC breaker rating check
    dc_breaker_node = G.nodes.get("dc_breaker")
    if dc_breaker_node:
        min_required = string_isc * 1.25
        actual_rating = dc_breaker_node.get("rating_a", 0)
        if actual_rating < min_required:
            issues.append({
                "type": "dc_breaker_undersized",
                "severity": "warning",
                "message": (
                    f"Disjoncteur DC ({actual_rating}A) sous-dimensionné, "
                    f"minimum requis: {min_required:.1f}A (Isc x 1.25)"
                ),
                "nodes": ["dc_breaker"],
            })

    return issues


# ---------------------------------------------------------------------------
# React Flow conversion
# ---------------------------------------------------------------------------

# Column assignments for manual hierarchical layout
_NODE_TYPE_COLUMN: dict[str, int] = {
    "panel": 0,
    "string": 1,
    "dc_box": 2,
    "dc_surge": 3,
    "dc_breaker": 4,
    "inverter": 5,
    "ac_breaker": 6,
    "ac_surge": 7,
    "ac_box": 8,
    "meter": 9,
    "grid": 10,
    "ground": 5,  # below inverter
}

_COLUMN_SPACING_X = 200
_ROW_SPACING_Y = 80
_STRING_GROUP_GAP = 40


def graph_to_reactflow(G: nx.DiGraph) -> dict:
    """
    Convert a networkx DiGraph to React Flow format with manual hierarchical layout.

    Returns {"nodes": [...], "edges": [...]}.
    """
    rf_nodes: list[dict] = []
    rf_edges: list[dict] = []

    # Group nodes by type for layout calculation
    nodes_by_type: dict[str, list[str]] = {}
    for node_id, attrs in G.nodes(data=True):
        ntype = attrs.get("node_type", "unknown")
        nodes_by_type.setdefault(ntype, []).append(node_id)

    # Calculate total vertical extent from panels to center other columns
    # Panels are grouped by string
    panel_nodes = nodes_by_type.get("panel", [])
    string_nodes = nodes_by_type.get("string", [])

    # Sort panel nodes by string then position
    def _panel_sort_key(nid: str) -> tuple[int, int]:
        attrs = G.nodes[nid]
        return (attrs.get("string", 0), attrs.get("position_in_string", 0))

    panel_nodes.sort(key=_panel_sort_key)

    # Sort string nodes by string number
    def _string_sort_key(nid: str) -> int:
        return G.nodes[nid].get("string", 0)

    string_nodes.sort(key=_string_sort_key)

    # Compute positions for panel nodes (grouped by string)
    panel_positions: dict[str, tuple[float, float]] = {}
    string_positions: dict[str, tuple[float, float]] = {}
    current_y = 0.0

    # Determine unique strings
    strings_in_panels: dict[int, list[str]] = {}
    for nid in panel_nodes:
        s = G.nodes[nid].get("string", 1)
        strings_in_panels.setdefault(s, []).append(nid)

    for s_num in sorted(strings_in_panels.keys()):
        panels_in_string = strings_in_panels[s_num]
        # Sort by position
        panels_in_string.sort(
            key=lambda nid: G.nodes[nid].get("position_in_string", 0)
        )
        string_start_y = current_y
        for i, nid in enumerate(panels_in_string):
            x = _NODE_TYPE_COLUMN["panel"] * _COLUMN_SPACING_X
            y = current_y + i * _ROW_SPACING_Y
            panel_positions[nid] = (x, y)

        # String combiner centered vertically relative to its panels
        string_center_y = string_start_y + (len(panels_in_string) - 1) * _ROW_SPACING_Y / 2
        string_id = f"string_{s_num}"
        if string_id in G.nodes:
            string_positions[string_id] = (
                _NODE_TYPE_COLUMN["string"] * _COLUMN_SPACING_X,
                string_center_y,
            )

        current_y += len(panels_in_string) * _ROW_SPACING_Y + _STRING_GROUP_GAP

    # Overall vertical center (based on panel extent)
    total_height = current_y - _STRING_GROUP_GAP if current_y > 0 else 0
    center_y = total_height / 2

    # Position singleton DC/AC chain nodes at center_y
    singleton_types = [
        "dc_box", "dc_surge", "dc_breaker", "inverter",
        "ac_breaker", "ac_surge", "ac_box", "meter", "grid",
    ]
    singleton_positions: dict[str, tuple[float, float]] = {}
    for ntype in singleton_types:
        nid = ntype  # node id matches type name for singletons
        if nid in G.nodes:
            col = _NODE_TYPE_COLUMN[ntype]
            singleton_positions[nid] = (col * _COLUMN_SPACING_X, center_y)

    # Ground node: below inverter
    if "ground" in G.nodes:
        inv_y = singleton_positions.get("inverter", (0, center_y))[1]
        singleton_positions["ground"] = (
            _NODE_TYPE_COLUMN["ground"] * _COLUMN_SPACING_X,
            inv_y + _ROW_SPACING_Y * 2,
        )

    # Merge all positions
    all_positions: dict[str, tuple[float, float]] = {}
    all_positions.update(panel_positions)
    all_positions.update(string_positions)
    all_positions.update(singleton_positions)

    # Build React Flow nodes
    for node_id, attrs in G.nodes(data=True):
        pos = all_positions.get(node_id, (0, 0))
        data = dict(attrs)
        rf_nodes.append({
            "id": node_id,
            "type": attrs.get("node_type", "default"),
            "position": {"x": pos[0], "y": pos[1]},
            "data": data,
        })

    # Build React Flow edges
    for source, target, attrs in G.edges(data=True):
        data = dict(attrs)
        rf_edges.append({
            "id": f"{source}-{target}",
            "source": source,
            "target": target,
            "type": "cable",
            "data": data,
        })

    return {"nodes": rf_nodes, "edges": rf_edges}


def reactflow_to_graph(nodes: list[dict], edges: list[dict]) -> nx.DiGraph:
    """
    Rebuild a networkx DiGraph from React Flow format.

    Inverse of graph_to_reactflow.
    """
    G = nx.DiGraph()

    for rf_node in nodes:
        node_id = rf_node["id"]
        attrs = dict(rf_node.get("data", {}))
        # Store position for potential round-trip
        attrs["_rf_position"] = rf_node.get("position", {"x": 0, "y": 0})
        if "type" in rf_node and "node_type" not in attrs:
            attrs["node_type"] = rf_node["type"]
        G.add_node(node_id, **attrs)

    for rf_edge in edges:
        source = rf_edge["source"]
        target = rf_edge["target"]
        attrs = dict(rf_edge.get("data", {}))
        G.add_edge(source, target, **attrs)

    return G


# ---------------------------------------------------------------------------
# Change propagation
# ---------------------------------------------------------------------------

def propagate_changes(G: nx.DiGraph, changed_node_id: str) -> nx.DiGraph:
    """
    BFS from changed_node_id, recalculating downstream ratings and cable sections.

    This handles cases where a user modifies a component (e.g., swaps panels)
    and dependent values need to be updated downstream.
    """
    if changed_node_id not in G:
        return G

    changed_attrs = G.nodes[changed_node_id]
    changed_type = changed_attrs.get("node_type", "")

    # Collect panel specs from panel nodes if a panel changed
    if changed_type == "panel":
        panel_specs = {
            "voc_v": changed_attrs.get("voc_v", 0),
            "vmp_v": changed_attrs.get("vmp_v", 0),
            "isc_a": changed_attrs.get("isc_a", 0),
            "imp_a": changed_attrs.get("imp_a", 0),
            "pmax_w": changed_attrs.get("pmax_w", 0),
        }
        string_num = changed_attrs.get("string")
        if string_num is not None:
            string_id = f"string_{string_num}"
            if string_id in G:
                # Count panels in this string
                panels_in_string = [
                    n for n in G.nodes
                    if G.nodes[n].get("node_type") == "panel"
                    and G.nodes[n].get("string") == string_num
                ]
                num_panels = len(panels_in_string)

                # Update string combiner
                G.nodes[string_id]["voc_v"] = panel_specs["voc_v"] * num_panels
                G.nodes[string_id]["vmp_v"] = panel_specs["vmp_v"] * num_panels
                G.nodes[string_id]["isc_a"] = panel_specs["isc_a"]
                G.nodes[string_id]["imp_a"] = panel_specs["imp_a"]
                G.nodes[string_id]["num_panels"] = num_panels

    # BFS downstream from changed node
    visited = set()
    queue = [changed_node_id]

    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)

        current_attrs = G.nodes[current]
        current_type = current_attrs.get("node_type", "")

        # Recalculate cable sections on outgoing edges
        for _, successor, edge_data in G.out_edges(current, data=True):
            cable_type = edge_data.get("cable_type", "dc")

            if cable_type == "dc":
                # Use string Isc for DC cables
                isc = current_attrs.get("isc_a", 0)
                vmp = current_attrs.get("vmp_v", 230)
                if isc > 0:
                    edge_data["section_mm2"] = calc_cable_section(
                        isc, voltage_ref=max(vmp, 1)
                    )
            elif cable_type == "ac":
                rated_current = current_attrs.get("rated_ac_current_a", 0)
                if rated_current > 0:
                    edge_data["section_mm2"] = calc_cable_section(rated_current)

            queue.append(successor)

        # Recalculate node-specific ratings
        if current_type == "dc_breaker":
            # Find upstream string Isc
            for predecessor in G.predecessors(current):
                pred_attrs = G.nodes[predecessor]
                if pred_attrs.get("node_type") in ("dc_surge", "dc_box"):
                    isc = pred_attrs.get("total_isc_a", pred_attrs.get("isc_a", 0))
                    if isc > 0:
                        # Use per-string Isc for breaker sizing
                        # Find any string node to get single-string Isc
                        string_isc = 0
                        for n in G.nodes:
                            if G.nodes[n].get("node_type") == "string":
                                string_isc = G.nodes[n].get("isc_a", 0)
                                break
                        if string_isc > 0:
                            new_rating = _next_standard(
                                string_isc * 1.25, STANDARD_BREAKER_RATINGS
                            )
                            G.nodes[current]["rating_a"] = new_rating
                            G.nodes[current]["label"] = f"Disj. DC {new_rating}A"

        elif current_type == "dc_box":
            # Recalculate total current from connected strings
            total_isc = 0
            num_strings = 0
            max_voc = 0
            for predecessor in G.predecessors(current):
                pred_attrs = G.nodes[predecessor]
                if pred_attrs.get("node_type") == "string":
                    total_isc += pred_attrs.get("isc_a", 0)
                    num_strings += 1
                    max_voc = max(max_voc, pred_attrs.get("voc_v", 0))
            G.nodes[current]["total_isc_a"] = total_isc
            G.nodes[current]["num_strings"] = num_strings
            if max_voc > 0:
                G.nodes[current]["total_voc_v"] = max_voc

    return G
