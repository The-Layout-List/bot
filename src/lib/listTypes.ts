// Shapes of the JSON files in the list repository's data folder

export interface ListRecord {
    user: string;
    link: string;
    percent: number;
    hz: number;
    enjoyment?: number;
    mobile?: boolean;
    [key: string]: unknown;
}

export interface ListLevel {
    id?: number;
    name: string;
    author?: string;
    creators: string[];
    verifier: string;
    verification: string;
    percentToQualify?: number;
    song?: string;
    records: ListRecord[];
    [key: string]: unknown;
}

export interface ListPack {
    name: string;
    difficulty: number | null;
    levels?: string[];
    [key: string]: unknown;
}

/** _flags.json: username -> country code */
export type ListFlags = Record<string, string>;

/** _list.json / _legacy.json: level filenames in list order */
export type ListOrder = string[];
