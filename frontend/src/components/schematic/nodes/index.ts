export { PanelNode } from "./PanelNode";
export { StringNode } from "./StringNode";
export { InverterNode } from "./InverterNode";
export { BreakerNode } from "./BreakerNode";
export { SurgeNode } from "./SurgeNode";
export { JunctionBoxNode } from "./JunctionBoxNode";
export { MeterNode } from "./MeterNode";
export { GridNode } from "./GridNode";
export { GroundNode } from "./GroundNode";

import { PanelNode } from "./PanelNode";
import { StringNode } from "./StringNode";
import { InverterNode } from "./InverterNode";
import { BreakerNode } from "./BreakerNode";
import { SurgeNode } from "./SurgeNode";
import { JunctionBoxNode } from "./JunctionBoxNode";
import { MeterNode } from "./MeterNode";
import { GridNode } from "./GridNode";
import { GroundNode } from "./GroundNode";

export const nodeTypes = {
  panel: PanelNode,
  string: StringNode,
  inverter: InverterNode,
  dc_breaker: BreakerNode,
  ac_breaker: BreakerNode,
  dc_surge: SurgeNode,
  ac_surge: SurgeNode,
  dc_box: JunctionBoxNode,
  ac_box: JunctionBoxNode,
  meter: MeterNode,
  grid: GridNode,
  ground: GroundNode,
} as const;
