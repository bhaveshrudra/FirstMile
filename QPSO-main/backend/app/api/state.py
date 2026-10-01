from ..graph.graph_model import TrafficGraph
from ..graph.graph_generator import generate_grid_graph
from ..traffic.simulator import TrafficSimulator

# Initialize active graph with a California-style junction network centered in SF.
active_graph = generate_grid_graph(rows=8, cols=8, center_lat=37.7749, center_lon=-122.4194, spacing_km=0.55)

# Initialize traffic simulator wrapping the active graph
active_simulator = TrafficSimulator(active_graph)
active_simulator.update_simulation_time(12.0) # start at noon
