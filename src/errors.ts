/**
 * Bu kütüphanenin fırlattığı tüm hataların temel sınıfı.
 */
export class YokAtlasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YokAtlasError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Çağıranın verdiği bir parametre geçersiz olduğunda fırlatılır (örn. boş kılavuz kodu).
 */
export class YokAtlasValidationError extends YokAtlasError {
  constructor(message: string) {
    super(message);
    this.name = "YokAtlasValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * YÖK Atlas API isteği ağ/HTTP seviyesinde başarısız olduğunda fırlatılır
 * (bağlantı hatası, HTTP hata kodu, ayrıştırılamayan yanıt vb.).
 */
export class YokAtlasAPIError extends YokAtlasError {
  public readonly status?: number;
  public readonly body?: string;
  public readonly cause?: unknown;

  constructor(message: string, options?: { status?: number; body?: string; cause?: unknown }) {
    super(message);
    this.name = "YokAtlasAPIError";
    this.status = options?.status;
    this.body = options?.body;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** İstenen kaynak (örn. kılavuz kodu) bulunamadığında fırlatılır. */
export class YokAtlasNotFoundError extends YokAtlasAPIError {
  constructor(message: string, options?: { status?: number; body?: string }) {
    super(message, options);
    this.name = "YokAtlasNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** API oran sınırlama (rate limit) durum kodu döndürdüğünde fırlatılır. */
export class YokAtlasRateLimitError extends YokAtlasAPIError {
  constructor(message: string, options?: { status?: number; body?: string }) {
    super(message, options);
    this.name = "YokAtlasRateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Akıllı arama (üniversite/program/il isim çözümü) bir sonuca ulaşamadığında fırlatılır.
 */
export class YokAtlasLookupError extends YokAtlasError {
  public readonly query: string;
  public readonly kind: "üniversite" | "program" | "il";
  public readonly suggestions: string[];

  constructor(query: string, options: { kind: "üniversite" | "program" | "il"; suggestions?: string[] }) {
    const base = query
      ? `'${query}' için bir ${options.kind} bulunamadı.`
      : `Boş bir ${options.kind} adı çözümlenemez.`;
    const message =
      options.suggestions && options.suggestions.length > 0
        ? `${base} Şunu mu demek istediniz: ${options.suggestions.join(", ")}?`
        : base;
    super(message);
    this.name = "YokAtlasLookupError";
    this.query = query;
    this.kind = options.kind;
    this.suggestions = options.suggestions ?? [];
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
