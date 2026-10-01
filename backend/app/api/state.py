import sys
import types
from typing import Dict
from ..digital_twin.engine import DigitalTwinEngine
from ..digital_twin.snapshot import SnapshotManager
from ..graph.graph_generator import generate_grid_graph
from ..traffic.simulator import TrafficSimulator

# Initialize root active twin with default transport graph and traffic simulator
_initial_graph = generate_grid_graph(rows=8, cols=8, center_lat=37.7749, center_lon=-122.4194, spacing_km=0.55)
_initial_simulator = TrafficSimulator(_initial_graph)
_initial_simulator.update_simulation_time(12.0)

active_twin = DigitalTwinEngine(
    graph=_initial_graph,
    simulator=_initial_simulator,
    name="active_twin"
)

snapshot_manager = SnapshotManager()
scenarios: Dict[str, DigitalTwinEngine] = {}
recovery_plans: Dict[str, Any] = {}
recovery_commits: Dict[str, Any] = {}


class _StateModule(types.ModuleType):
    """
    Module proxy ensuring backward compatibility:
    Reading/writing `state.active_graph` and `state.active_simulator`
    transparently proxies directly to `state.active_twin`.
    Also manages snapshot_manager and scenarios registry.
    """
    @property
    def active_twin(self) -> DigitalTwinEngine:
        return self._twin

    @active_twin.setter
    def active_twin(self, twin: DigitalTwinEngine):
        self._twin = twin

    @property
    def scenarios(self) -> Dict[str, DigitalTwinEngine]:
        if not hasattr(self, "_scenarios"):
            self._scenarios = {}
        return self._scenarios

    @scenarios.setter
    def scenarios(self, val: Dict[str, DigitalTwinEngine]):
        self._scenarios = val

    @property
    def recovery_plans(self) -> Dict[str, Any]:
        if not hasattr(self, "_recovery_plans"):
            self._recovery_plans = {}
        return self._recovery_plans

    @recovery_plans.setter
    def recovery_plans(self, val: Dict[str, Any]):
        self._recovery_plans = val

    @property
    def recovery_commits(self) -> Dict[str, Any]:
        if not hasattr(self, "_recovery_commits"):
            self._recovery_commits = {}
        return self._recovery_commits

    @recovery_commits.setter
    def recovery_commits(self, val: Dict[str, Any]):
        self._recovery_commits = val

    @property
    def active_graph(self):
        return self._twin.graph

    @active_graph.setter
    def active_graph(self, new_graph):
        self._twin.graph = new_graph
        self._twin._mark_updated()

    @property
    def active_simulator(self):
        return self._twin.simulator

    @active_simulator.setter
    def active_simulator(self, new_simulator):
        self._twin.simulator = new_simulator
        self._twin.simulation_time = new_simulator.current_hour
        self._twin._mark_updated()


# Wrap this module in the proxy
_proxy = _StateModule(__name__)
_proxy._twin = active_twin
_proxy.snapshot_manager = snapshot_manager
_proxy.scenarios = scenarios
_proxy.recovery_plans = recovery_plans
_proxy.recovery_commits = recovery_commits
_proxy.DigitalTwinEngine = DigitalTwinEngine
_proxy.SnapshotManager = SnapshotManager
_proxy.generate_grid_graph = generate_grid_graph
_proxy.TrafficSimulator = TrafficSimulator

# Populate module dictionary with other globals
for k, v in list(globals().items()):
    if not k.startswith("__"):
        setattr(_proxy, k, v)

sys.modules[__name__] = _proxy
