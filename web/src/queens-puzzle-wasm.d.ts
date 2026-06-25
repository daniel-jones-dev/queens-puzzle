declare module "queens-puzzle-wasm" {
  export class WasmHint {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    changes(): Uint32Array;
    description(): string;
    involved(): Uint32Array;
  }

  export class WasmPuzzle {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cell_region(row: number, col: number): number | undefined;
    cell_state(row: number, col: number): number;
    cells_affected_by_queen(row: number, col: number): Uint32Array;
    clashing_queens(): Uint32Array;
    count_solutions(): number;
    difficulty(): string | undefined;
    static from_json(input: string): WasmPuzzle;
    static generate(n: number, seed: number): WasmPuzzle;
    is_solved(): boolean;
    n(): number;
    static new_empty(n: number): WasmPuzzle;
    next_hint(): WasmHint | undefined;
    static region_color_hex(region_index: number): string;
    static scatter_queens(n: number, seed: number): WasmPuzzle;
    set_cell_region(row: number, col: number, region?: number | null): void;
    set_cell_state(row: number, col: number, state: number): void;
    to_json(): string;
  }

  export type InitInput =
    | RequestInfo
    | URL
    | Response
    | BufferSource
    | WebAssembly.Module;

  export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    [key: string]: unknown;
  }

  export type SyncInitInput = BufferSource | WebAssembly.Module;

  export function initSync(
    module: { module: SyncInitInput } | SyncInitInput
  ): InitOutput;

  export default function init(
    module_or_path?:
      | { module_or_path: InitInput | Promise<InitInput> }
      | InitInput
      | Promise<InitInput>
  ): Promise<InitOutput>;
}
