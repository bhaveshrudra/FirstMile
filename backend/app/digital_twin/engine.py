import time
import copy
from typing import Dict, List, Optional, Tuple, Any, Union

from ..graph.graph_model import TrafficGraph
from ..graph.graph_generator import generate_grid_graph
from ..traffic.simulator import TrafficSimulator
from ..traffic.traffic_model import TrafficIncident

from ..models.supplier import Supplier
from ..models.warehouse import Warehouse
from ..models.vehicle import Vehicle
from ..models.customer import Customer
from ..models.inventory import InventoryItem
from ..models.order import Order, OrderStatus
from ..models.shipment import Shipment, ShipmentStatus


class DigitalTwinEngine:
    """
    Authoritative in-memory Digital Twin state manager for the logistics ecosystem.
    Composes transport network graph, traffic physics simulator, and business entities.
    """

    def __init__(
        self,
        graph: Optional[TrafficGraph] = None,
        simulator: Optional[TrafficSimulator] = None,
        name: str = "baseline",
    ):
        self.name: str = name
        self.version: int = 1
        self.last_updated: float = time.time()

        # Transportation and Traffic Engine
        if graph is not None:
            self.graph = graph
        else:
            self.graph = generate_grid_graph(rows=8, cols=8, center_lat=37.7749, center_lon=-122.4194, spacing_km=0.55)

        if simulator is not None:
            self.simulator = simulator
        else:
            self.simulator = TrafficSimulator(self.graph)
            self.simulator.update_simulation_time(12.0)

        self._name = name

    @property
    def simulation_time(self) -> float:
        """Returns virtual hour synchronized with the traffic simulator."""
        return self.simulator.current_hour

    @simulation_time.setter
    def simulation_time(self, hour: float):
        """Sets virtual hour and synchronizes with simulator."""
        self.simulator.current_hour = hour % 24.0

    @property
    def name(self) -> str:
        return self._name

    @name.setter
    def name(self, val: str):
        self._name = val


        # Logistics Entities (keyed by unique ID / composite key)
        self.suppliers: Dict[str, Supplier] = {}
        self.warehouses: Dict[str, Warehouse] = {}
        self.vehicles: Dict[str, Vehicle] = {}
        self.customers: Dict[str, Customer] = {}
        self.inventory: Dict[str, InventoryItem] = {}  # key: f"{warehouse_id}:{sku}"
        self.orders: Dict[str, Order] = {}
        self.shipments: Dict[str, Shipment] = {}
        self.disruptions: Dict[str, Any] = {}

    def _mark_updated(self):
        self.version += 1
        self.last_updated = time.time()

    # ==========================================
    # Supplier Management
    # ==========================================
    def add_supplier(self, supplier: Union[Supplier, Dict[str, Any]]) -> Supplier:
        if isinstance(supplier, dict):
            supplier = Supplier(**supplier)
        self.suppliers[supplier.id] = supplier
        self._mark_updated()
        return supplier

    def get_supplier(self, supplier_id: str) -> Optional[Supplier]:
        return self.suppliers.get(supplier_id)

    def list_suppliers(self) -> List[Supplier]:
        return list(self.suppliers.values())

    def remove_supplier(self, supplier_id: str) -> bool:
        if supplier_id in self.suppliers:
            del self.suppliers[supplier_id]
            self._mark_updated()
            return True
        return False

    # ==========================================
    # Warehouse Management
    # ==========================================
    def add_warehouse(self, warehouse: Union[Warehouse, Dict[str, Any]]) -> Warehouse:
        if isinstance(warehouse, dict):
            warehouse = Warehouse(**warehouse)
        self.warehouses[warehouse.id] = warehouse
        self._mark_updated()
        return warehouse

    def get_warehouse(self, warehouse_id: str) -> Optional[Warehouse]:
        return self.warehouses.get(warehouse_id)

    def list_warehouses(self) -> List[Warehouse]:
        return list(self.warehouses.values())

    def remove_warehouse(self, warehouse_id: str) -> bool:
        if warehouse_id in self.warehouses:
            del self.warehouses[warehouse_id]
            self._mark_updated()
            return True
        return False

    # ==========================================
    # Vehicle Management
    # ==========================================
    def add_vehicle(self, vehicle: Union[Vehicle, Dict[str, Any]]) -> Vehicle:
        if isinstance(vehicle, dict):
            vehicle = Vehicle(**vehicle)
        self.vehicles[vehicle.id] = vehicle
        self._mark_updated()
        return vehicle

    def get_vehicle(self, vehicle_id: str) -> Optional[Vehicle]:
        return self.vehicles.get(vehicle_id)

    def list_vehicles(self) -> List[Vehicle]:
        return list(self.vehicles.values())

    def remove_vehicle(self, vehicle_id: str) -> bool:
        if vehicle_id in self.vehicles:
            del self.vehicles[vehicle_id]
            self._mark_updated()
            return True
        return False

    # ==========================================
    # Customer Management
    # ==========================================
    def add_customer(self, customer: Union[Customer, Dict[str, Any]]) -> Customer:
        if isinstance(customer, dict):
            customer = Customer(**customer)
        self.customers[customer.id] = customer
        self._mark_updated()
        return customer

    def get_customer(self, customer_id: str) -> Optional[Customer]:
        return self.customers.get(customer_id)

    def list_customers(self) -> List[Customer]:
        return list(self.customers.values())

    def remove_customer(self, customer_id: str) -> bool:
        if customer_id in self.customers:
            del self.customers[customer_id]
            self._mark_updated()
            return True
        return False

    # ==========================================
    # Inventory Management
    # ==========================================
    @staticmethod
    def _inv_key(warehouse_id: str, sku: str) -> str:
        return f"{warehouse_id}:{sku}"

    def add_inventory_item(self, item: Union[InventoryItem, Dict[str, Any]]) -> InventoryItem:
        if isinstance(item, dict):
            item = InventoryItem(**item)
        key = self._inv_key(item.warehouse_id, item.sku)
        self.inventory[key] = item
        self._mark_updated()
        return item

    def get_inventory(self, warehouse_id: str, sku: str) -> Optional[InventoryItem]:
        return self.inventory.get(self._inv_key(warehouse_id, sku))

    def list_inventory(self, warehouse_id: Optional[str] = None) -> List[InventoryItem]:
        if warehouse_id is not None:
            return [item for item in self.inventory.values() if item.warehouse_id == warehouse_id]
        return list(self.inventory.values())

    def remove_inventory_item(self, warehouse_id: str, sku: str) -> bool:
        key = self._inv_key(warehouse_id, sku)
        if key in self.inventory:
            del self.inventory[key]
            self._mark_updated()
            return True
        return False

    # ==========================================
    # Order Management
    # ==========================================
    def add_order(self, order: Union[Order, Dict[str, Any]]) -> Order:
        if isinstance(order, dict):
            order = Order(**order)
        self.orders[order.id] = order
        self._mark_updated()
        return order

    def get_order(self, order_id: str) -> Optional[Order]:
        return self.orders.get(order_id)

    def list_orders(self, status: Optional[OrderStatus] = None) -> List[Order]:
        if status is not None:
            return [o for o in self.orders.values() if o.status == status]
        return list(self.orders.values())

    def remove_order(self, order_id: str) -> bool:
        if order_id in self.orders:
            del self.orders[order_id]
            self._mark_updated()
            return True
        return False

    # ==========================================
    # Shipment Management
    # ==========================================
    def add_shipment(self, shipment: Union[Shipment, Dict[str, Any]]) -> Shipment:
        if isinstance(shipment, dict):
            shipment = Shipment(**shipment)
        self.shipments[shipment.id] = shipment
        self._mark_updated()
        return shipment

    def get_shipment(self, shipment_id: str) -> Optional[Shipment]:
        return self.shipments.get(shipment_id)

    def list_shipments(self, status: Optional[ShipmentStatus] = None) -> List[Shipment]:
        if status is not None:
            return [s for s in self.shipments.values() if s.status == status]
        return list(self.shipments.values())

    def remove_shipment(self, shipment_id: str) -> bool:
        if shipment_id in self.shipments:
            del self.shipments[shipment_id]
            self._mark_updated()
            return True
        return False

    # ==========================================
    # Simulation Clock & State Control
    # ==========================================
    def update_simulation_time(self, hour: float):
        """Updates digital twin and simulator clock."""
        self.simulation_time = hour % 24.0
        self.simulator.update_simulation_time(self.simulation_time)
        self._mark_updated()

    # ==========================================
    # State Summary
    # ==========================================
    def get_summary(self) -> Dict[str, Any]:
        """Returns JSON-serializable aggregate statistics for the twin."""
        return {
            "name": self.name,
            "version": self.version,
            "simulation_time": self.simulation_time,
            "last_updated": self.last_updated,
            "supplier_count": len(self.suppliers),
            "warehouse_count": len(self.warehouses),
            "vehicle_count": len(self.vehicles),
            "customer_count": len(self.customers),
            "inventory_item_count": len(self.inventory),
            "order_count": len(self.orders),
            "shipment_count": len(self.shipments),
            "active_disruptions": len(self.simulator.incidents),
            "graph_node_count": self.graph.graph.number_of_nodes(),
            "graph_edge_count": self.graph.graph.number_of_edges(),
        }

    # ==========================================
    # Serialization
    # ==========================================
    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes complete digital twin state into JSON-safe Python primitives.
        Guarantees deep independence when converted.
        """
        active_incidents = [inc.model_dump() for inc in self.simulator.incidents.values()]
        return {
            "name": self.name,
            "version": self.version,
            "simulation_time": self.simulation_time,
            "last_updated": self.last_updated,
            "summary": self.get_summary(),
            "suppliers": [s.model_dump() for s in self.suppliers.values()],
            "warehouses": [w.model_dump() for w in self.warehouses.values()],
            "vehicles": [v.model_dump() for v in self.vehicles.values()],
            "customers": [c.model_dump() for c in self.customers.values()],
            "inventory": [item.model_dump() for item in self.inventory.values()],
            "orders": [o.model_dump() for o in self.orders.values()],
            "shipments": [s.model_dump() for s in self.shipments.values()],
            "disruptions": [d.model_dump() if hasattr(d, "model_dump") else d for d in getattr(self, "disruptions", {}).values()],
            "graph": self.graph.to_dict(),
            "active_incidents": active_incidents,
            "traffic_status": {
                "hour": self.simulator.current_hour,
                "active_incidents": active_incidents
            }
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DigitalTwinEngine":
        """
        Reconstructs an independent DigitalTwinEngine instance from serialized data.
        """
        graph = TrafficGraph.from_dict(data.get("graph", {}))
        simulator = TrafficSimulator(graph)
        simulator.current_hour = data.get("simulation_time", 12.0)

        # Restore active incidents
        for inc_data in data.get("active_incidents", []):
            incident = TrafficIncident(**inc_data)
            simulator.add_incident(incident)

        twin = cls(
            graph=graph,
            simulator=simulator,
            name=data.get("name", "reconstructed")
        )
        twin.version = data.get("version", 1)
        twin.simulation_time = data.get("simulation_time", 12.0)
        twin.last_updated = data.get("last_updated", time.time())

        # Populate logistics entities
        for s in data.get("suppliers", []):
            twin.add_supplier(Supplier(**s))
        for w in data.get("warehouses", []):
            twin.add_warehouse(Warehouse(**w))
        for v in data.get("vehicles", []):
            twin.add_vehicle(Vehicle(**v))
        for c in data.get("customers", []):
            twin.add_customer(Customer(**c))
        for item in data.get("inventory", []):
            twin.add_inventory_item(InventoryItem(**item))
        for o in data.get("orders", []):
            twin.add_order(Order(**o))
        for s in data.get("shipments", []):
            twin.add_shipment(Shipment(**s))

        # Restore disruptions
        twin.disruptions = {}
        for d in data.get("disruptions", []):
            twin.disruptions[d.get("id")] = d

        # Reset version to snapshot version
        twin.version = data.get("version", 1)
        return twin

    # ==========================================
    # Scenario Cloning
    # ==========================================
    def clone_for_scenario(self, scenario_name: str) -> "DigitalTwinEngine":
        """
        Creates an independent twin copy for what-if scenario exploration.
        Mutations to the clone do not affect this baseline twin.
        """
        data = self.to_dict()
        data["name"] = f"{self.name}_scenario_{scenario_name}"
        data["version"] = 1
        return DigitalTwinEngine.from_dict(data)
