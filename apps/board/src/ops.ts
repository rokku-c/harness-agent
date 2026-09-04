/** Barrel: Board ops split by CONCEPT (see ./ops/).
 *  schemas.ts = declared input/output shapes; read-ops.ts = board_view +
 *  board_item reads; create-op.ts = the coordinator's only write (children);
 *  coordinator.ts = assembly + binding uri. The coordinator only READS the
 *  board and CREATES children - starting/reporting stays with executors,
 *  keeping coordination free of the governor. */
export { makeBoardCoordinatorOps, boardCoordinatorBinding } from "./ops/coordinator.ts"
