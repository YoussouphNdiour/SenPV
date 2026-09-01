"""
Tests for the schematic graph service.

Covers: generation, validation, React Flow conversion (round-trip),
and auto-dimensioning of breakers/cable sections.
"""

import pytest
import networkx as nx

from app.services.schematic_graph import (
    calc_ac_breaker_rating,
    calc_cable_section,
    calc_dc_breaker_rating,
    generate_schematic,
    graph_to_reactflow,
    propagate_changes,
    reactflow_to_graph,
    validate_electrical,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def panel_specs():
    """Typical 400W panel specs."""
    return {
        "pmax_w": 400,
        "voc_v": 49.5,
        "vmp_v": 41.5,
        "isc_a": 10.36,
        "imp_a": 9.64,
    }


@pytest.fixture
def inverter_specs():
    """Typical 5kW string inverter specs."""
    return {
        "rated_ac_power_kw": 5.0,
        "max_pv_voltage_v": 600,
        "mppt_voltage_range_v": "80-550",
        "num_mppt": 2,
        "strings_per_mppt": 1,
        "max_input_current_a": 15.0,
        "max_short_circuit_current_a": 18.0,
        "rated_ac_current_a": 22.0,
        "rated_output_voltage_v": 230,
    }


@pytest.fixture
def panel_layout():
    """10 panels, 2 strings of 5."""
    return {
        "num_panels": 10,
        "num_strings": 2,
        "panels_per_string": 5,
    }


@pytest.fixture
def graph(panel_layout, panel_specs, inverter_specs):
    """Pre-generated schematic graph."""
    return generate_schematic(panel_layout, panel_specs, inverter_specs)


# ---------------------------------------------------------------------------
# Generation tests
# ---------------------------------------------------------------------------

class TestGenerateSchematic:
    def test_generates_correct_node_count(self, graph, panel_layout):
        """10 panels + 2 strings + dc_box + dc_surge + dc_breaker + inverter
        + ac_breaker + ac_surge + ac_box + meter + grid + ground = 22 nodes."""
        num_panels = panel_layout["num_panels"]
        num_strings = panel_layout["num_strings"]
        # panels + strings + 10 fixed nodes (dc_box, dc_surge, dc_breaker, inverter,
        # ac_breaker, ac_surge, ac_box, meter, grid, ground)
        expected = num_panels + num_strings + 10
        assert len(graph.nodes) == expected

    def test_all_node_types_present(self, graph):
        node_types = {attrs["node_type"] for _, attrs in graph.nodes(data=True)}
        expected_types = {
            "panel", "string", "dc_box", "dc_surge", "dc_breaker",
            "inverter", "ac_breaker", "ac_surge", "ac_box",
            "meter", "grid", "ground",
        }
        assert expected_types == node_types

    def test_graph_is_connected(self, graph):
        """The underlying undirected graph should be connected."""
        undirected = graph.to_undirected()
        assert nx.is_connected(undirected)

    def test_panels_link_to_strings(self, graph):
        """Each panel should be reachable from its string combiner via predecessors."""
        for node_id, attrs in graph.nodes(data=True):
            if attrs["node_type"] == "string":
                string_num = attrs["string"]
                # All panel nodes for this string should reach the string node
                for pnode, pattrs in graph.nodes(data=True):
                    if pattrs["node_type"] == "panel" and pattrs["string"] == string_num:
                        assert nx.has_path(graph, pnode, node_id)

    def test_flow_panels_to_grid(self, graph):
        """There should be a path from every panel node to the grid node."""
        for node_id, attrs in graph.nodes(data=True):
            if attrs["node_type"] == "panel":
                assert nx.has_path(graph, node_id, "grid")

    def test_ground_connections(self, graph):
        """Ground should be connected to inverter, dc_surge, and ac_surge."""
        ground_preds = set(graph.predecessors("ground"))
        assert "inverter" in ground_preds
        assert "dc_surge" in ground_preds
        assert "ac_surge" in ground_preds

    def test_edge_cable_types(self, graph):
        """All edges should have a cable_type attribute."""
        for u, v, attrs in graph.edges(data=True):
            assert "cable_type" in attrs
            assert attrs["cable_type"] in ("dc", "ac", "ground")

    def test_edge_sections(self, graph):
        """All edges should have a section_mm2 attribute."""
        for u, v, attrs in graph.edges(data=True):
            assert "section_mm2" in attrs
            assert attrs["section_mm2"] > 0


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

class TestValidateElectrical:
    def test_valid_config_no_critical_errors(
        self, graph, panel_specs, inverter_specs, panel_layout
    ):
        """A properly sized system should have no critical errors."""
        errors = validate_electrical(graph, panel_specs, inverter_specs, panel_layout)
        critical = [e for e in errors if e["severity"] == "critical"]
        assert len(critical) == 0

    def test_overvoltage_detected(self, panel_specs, inverter_specs):
        """Too many panels in series should trigger overvoltage."""
        layout = {
            "num_panels": 28,
            "num_strings": 2,
            "panels_per_string": 14,  # 14 × 49.5V = 693V > 600V max
        }
        G = generate_schematic(layout, panel_specs, inverter_specs)
        errors = validate_electrical(G, panel_specs, inverter_specs, layout)
        overvoltage = [e for e in errors if e["type"] == "overvoltage"]
        assert len(overvoltage) == 1
        assert overvoltage[0]["severity"] == "critical"

    def test_mppt_range_warning(self, panel_specs, inverter_specs):
        """Vmp outside MPPT range should trigger warning."""
        layout = {
            "num_panels": 2,
            "num_strings": 1,
            "panels_per_string": 2,  # 2 × 41.5V = 83V, barely in 80-550 range
        }
        # Modify MPPT range to make it fail
        specs = {**inverter_specs, "mppt_voltage_range_v": "120-550"}
        G = generate_schematic(layout, panel_specs, specs)
        errors = validate_electrical(G, panel_specs, specs, layout)
        mppt_warnings = [e for e in errors if e["type"] == "mppt_range"]
        assert len(mppt_warnings) == 1
        assert mppt_warnings[0]["severity"] == "warning"

    def test_overcurrent_detected(self, panel_specs, inverter_specs):
        """Isc exceeding max input current should trigger critical error."""
        specs = {**inverter_specs, "max_input_current_a": 5.0}  # Very low limit
        layout = {
            "num_panels": 10,
            "num_strings": 2,
            "panels_per_string": 5,
        }
        G = generate_schematic(layout, panel_specs, specs)
        errors = validate_electrical(G, panel_specs, specs, layout)
        overcurrent = [e for e in errors if e["type"] == "overcurrent_mppt"]
        assert len(overcurrent) == 1
        assert overcurrent[0]["severity"] == "critical"

    def test_strings_exceeded_detected(self, panel_specs, inverter_specs):
        """Too many strings for MPPT capacity should trigger critical error."""
        layout = {
            "num_panels": 15,
            "num_strings": 3,  # 3 strings but only 2 MPPTs × 1 string each
            "panels_per_string": 5,
        }
        G = generate_schematic(layout, panel_specs, inverter_specs)
        errors = validate_electrical(G, panel_specs, inverter_specs, layout)
        exceeded = [e for e in errors if e["type"] == "strings_exceeded"]
        assert len(exceeded) == 1
        assert exceeded[0]["severity"] == "critical"

    def test_floating_node_detected(self, panel_specs, inverter_specs, panel_layout):
        """A node with no edges should trigger a warning."""
        G = generate_schematic(panel_layout, panel_specs, inverter_specs)
        # Add an isolated node
        G.add_node("floating_test", node_type="panel", label="Floating")
        errors = validate_electrical(G, panel_specs, inverter_specs, panel_layout)
        floating = [e for e in errors if e["type"] == "floating_node"]
        assert len(floating) >= 1
        assert any("floating_test" in (e.get("nodes") or []) for e in floating)


# ---------------------------------------------------------------------------
# React Flow conversion tests
# ---------------------------------------------------------------------------

class TestReactFlowConversion:
    def test_graph_to_reactflow_format(self, graph):
        rf = graph_to_reactflow(graph)
        assert "nodes" in rf
        assert "edges" in rf
        assert len(rf["nodes"]) == len(graph.nodes)
        assert len(rf["edges"]) == len(graph.edges)

    def test_reactflow_node_structure(self, graph):
        rf = graph_to_reactflow(graph)
        for node in rf["nodes"]:
            assert "id" in node
            assert "type" in node
            assert "position" in node
            assert "x" in node["position"]
            assert "y" in node["position"]
            assert "data" in node

    def test_reactflow_edge_structure(self, graph):
        rf = graph_to_reactflow(graph)
        for edge in rf["edges"]:
            assert "id" in edge
            assert "source" in edge
            assert "target" in edge
            assert "type" in edge
            assert edge["type"] == "cable"

    def test_round_trip_preserves_nodes(self, graph):
        """Converting graph -> React Flow -> graph should preserve all nodes."""
        rf = graph_to_reactflow(graph)
        G2 = reactflow_to_graph(rf["nodes"], rf["edges"])
        assert set(G2.nodes) == set(graph.nodes)

    def test_round_trip_preserves_edges(self, graph):
        """Converting graph -> React Flow -> graph should preserve all edges."""
        rf = graph_to_reactflow(graph)
        G2 = reactflow_to_graph(rf["nodes"], rf["edges"])
        assert set(G2.edges) == set(graph.edges)

    def test_round_trip_preserves_node_types(self, graph):
        """Node types should survive the round-trip."""
        rf = graph_to_reactflow(graph)
        G2 = reactflow_to_graph(rf["nodes"], rf["edges"])
        for node_id in graph.nodes:
            assert G2.nodes[node_id]["node_type"] == graph.nodes[node_id]["node_type"]

    def test_round_trip_preserves_edge_cable_type(self, graph):
        """Edge cable_type should survive the round-trip."""
        rf = graph_to_reactflow(graph)
        G2 = reactflow_to_graph(rf["nodes"], rf["edges"])
        for u, v in graph.edges:
            assert G2.edges[u, v]["cable_type"] == graph.edges[u, v]["cable_type"]

    def test_hierarchical_layout_x_ordering(self, graph):
        """Panels should be leftmost, grid rightmost."""
        rf = graph_to_reactflow(graph)
        nodes_by_type = {}
        for n in rf["nodes"]:
            ntype = n["data"]["node_type"]
            nodes_by_type.setdefault(ntype, []).append(n)

        panel_x = nodes_by_type["panel"][0]["position"]["x"]
        inverter_x = nodes_by_type["inverter"][0]["position"]["x"]
        grid_x = nodes_by_type["grid"][0]["position"]["x"]

        assert panel_x < inverter_x < grid_x


# ---------------------------------------------------------------------------
# Auto-dimensioning tests
# ---------------------------------------------------------------------------

class TestAutoDimensioning:
    def test_dc_breaker_rating(self, panel_specs, panel_layout):
        """DC breaker should be Isc × 1.25, rounded up to standard."""
        rating = calc_dc_breaker_rating(panel_specs, panel_layout)
        min_required = panel_specs["isc_a"] * 1.25  # 10.36 × 1.25 = 12.95
        assert rating >= min_required
        assert rating in [6, 10, 16, 20, 25, 32, 40, 50, 63]
        assert rating == 16  # 12.95 rounds up to 16A

    def test_ac_breaker_rating(self, inverter_specs):
        """AC breaker should be Iac × 1.25, rounded up to standard."""
        rating = calc_ac_breaker_rating(inverter_specs)
        min_required = inverter_specs["rated_ac_current_a"] * 1.25  # 22 × 1.25 = 27.5
        assert rating >= min_required
        assert rating in [6, 10, 16, 20, 25, 32, 40, 50, 63]
        assert rating == 32  # 27.5 rounds up to 32A

    def test_cable_section_standard(self):
        """Cable section should be rounded up to standard size."""
        section = calc_cable_section(10.0, length_m=10)
        assert section in [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50]
        assert section > 0

    def test_cable_section_increases_with_current(self):
        """Higher current should require larger cable section."""
        s1 = calc_cable_section(5.0, length_m=10)
        s2 = calc_cable_section(30.0, length_m=10)
        assert s2 >= s1

    def test_cable_section_increases_with_length(self):
        """Longer cable should require larger section."""
        s1 = calc_cable_section(10.0, length_m=5)
        s2 = calc_cable_section(10.0, length_m=50)
        assert s2 >= s1

    def test_breaker_ratings_in_graph(self, graph):
        """Generated graph should have correct breaker ratings."""
        dc_breaker = graph.nodes["dc_breaker"]
        ac_breaker = graph.nodes["ac_breaker"]
        assert "rating_a" in dc_breaker
        assert "rating_a" in ac_breaker
        assert dc_breaker["rating_a"] >= graph.nodes["dc_breaker"]["rating_a"]


# ---------------------------------------------------------------------------
# Propagation test
# ---------------------------------------------------------------------------

class TestPropagateChanges:
    def test_propagate_updates_downstream(self, graph):
        """Changing a panel spec should propagate through the graph."""
        # Modify a panel's specs
        graph.nodes["panel_1_1"]["isc_a"] = 15.0
        graph.nodes["panel_1_1"]["voc_v"] = 55.0
        graph.nodes["panel_1_1"]["vmp_v"] = 46.0

        G_updated = propagate_changes(graph, "panel_1_1")

        # String combiner should have updated values
        string_1 = G_updated.nodes["string_1"]
        assert string_1["isc_a"] == 15.0
