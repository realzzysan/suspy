export interface ScanResult {
    url: string;
    confidence_score: number;
    block_type: 'url' | 'hostname' | null;
    category: 'phishing' | 'pornography' | 'scam' | 'malware' | null;
    reason: string;
}

export interface ScanError {
    error: true;
    url: string;
    reason: string;
}

export type ScanResultExtended = ScanResult & Partial<{ 
    id: number; 
    first_seen: Date;
}>;