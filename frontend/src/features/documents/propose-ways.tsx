// The propose dialog's ways in beyond typing, pasting and a file (ACT-ways-in;
// docs/demos/shared/page-documents.js `wayPanel`). Catalog search over the catalogs that can be
// searched, and below it the record link or ID for those that cannot. Barcode scanning is
// continuous: a hardware scanner types the code and presses Enter, so a focused field that adds
// on Enter and waits is the whole of it, and the camera feeds the same loop while an Input
// plugin reads barcodes: continuously where the browser reads them, otherwise one photo per book
// that the plugin reads on the server. A photo is read and matched to catalog records, and nothing is added
// until one is picked. Each way is shown only while its plugin is enabled
// (PERM-absent-not-disabled); the dialog decides which.
// TODO(rrandiak): labels move to i18n.

import { useMutation, useQuery } from "@tanstack/react-query";
import type { PhotoReading, ProposalSettings } from "@vera/contract/proposals";
import type { ProposalLine } from "@vera/domain/proposals";
import { readIdentifier } from "@vera/domain/proposals";
import { Camera, ExternalLink, ScanBarcode } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/api/http";
import { readBarcode, readPhoto, readRecordLink, searchCatalogs } from "@/api/proposals";
import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIdentifierRules } from "@/features/documents/identifier-rules";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

type Add = (lines: ProposalLine[], source: string) => void;

const allCatalogs = "all";

function catalogLine(catalogId: string): ProposalLine {
  return { type: "catalogId", value: catalogId, unit: null, reason: null };
}

// ---------------------------------------------------------------- catalog search

interface CatalogSearchWayProps {
  searchCatalogs: ProposalSettings["searchCatalogs"];
  linkCatalogs: ProposalSettings["linkCatalogs"];
  onAdd: Add;
}

export function CatalogSearchWay({
  searchCatalogs: catalogs,
  linkCatalogs,
  onAdd,
}: CatalogSearchWayProps) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [catalogId, setCatalogId] = useState(allCatalogs);
  const picked = catalogId === allCatalogs ? null : catalogId;
  const { data: hits, isFetching } = useQuery({
    queryKey: ["proposals", "catalog-search", query, picked],
    queryFn: () => searchCatalogs(query, picked),
    enabled: query !== "",
    staleTime: 60_000,
  });

  return (
    <div className="grid gap-3">
      {catalogs.length > 0 && (
        <div className="grid gap-2">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(text.trim());
            }}
          >
            <Input
              aria-label="Search the catalog"
              placeholder="title, author or record ID"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="h-8 min-w-48 flex-1"
            />
            {catalogs.length > 1 && (
              <Select value={catalogId} onValueChange={setCatalogId}>
                <SelectTrigger size="sm" aria-label="Catalog" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allCatalogs}>
                    All searchable catalogs ({catalogs.length})
                  </SelectItem>
                  {catalogs.map((catalog) => (
                    <SelectItem key={catalog.id} value={catalog.id}>
                      {catalog.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button type="submit" size="sm" variant="outline" disabled={text.trim() === ""}>
              Search
            </Button>
          </form>
          {query !== "" && hits !== undefined && hits.length === 0 && !isFetching && (
            <p className="text-xs text-muted-foreground">Nothing found for “{query}”.</p>
          )}
          {hits !== undefined && hits.length > 0 && (
            <ul>
              {hits.map((hit) => (
                <li
                  key={`${hit.catalog.id}:${hit.catalogId}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b py-1.5 text-sm last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <b className="font-semibold">{hit.title}</b>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{hit.catalogId}</span>
                    {hit.units.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {plural(hit.units.length, "volume or issue", "volumes or issues")}
                      </span>
                    )}{" "}
                    {catalogs.length > 1 && (
                      <ToneBadge tone="slate" className="px-1.5 py-0 text-2xs">
                        {hit.catalog.name}
                      </ToneBadge>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onAdd([catalogLine(hit.catalogId)], `catalog search · ${hit.catalog.name}`)
                    }
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {linkCatalogs.length > 0 && (
        <RecordLinkWay catalogs={linkCatalogs} hasSearch={catalogs.length > 0} onAdd={onAdd} />
      )}
    </div>
  );
}

// A catalog that cannot be searched from here: the person finds the record there and pastes its
// link or ID, which the catalog adapter reads.
function RecordLinkWay({
  catalogs,
  hasSearch,
  onAdd,
}: {
  catalogs: ProposalSettings["linkCatalogs"];
  hasSearch: boolean;
  onAdd: Add;
}) {
  const id = useId();
  const [link, setLink] = useState("");
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? "");
  const catalog = catalogs.find((candidate) => candidate.id === catalogId) ?? catalogs[0];
  const read = useMutation({
    mutationFn: readRecordLink,
    onSuccess: ({ catalogId: recordId }) => {
      onAdd([catalogLine(recordId)], `record link · ${catalog?.name ?? ""}`);
      setLink("");
    },
  });
  const refusal =
    read.error instanceof ApiError && read.error.status === 422
      ? `${catalog?.name ?? "The catalog"} reads no record in that. Paste the address of the record's page, or its ID.`
      : read.isError
        ? "It could not be read. Try again."
        : null;

  return (
    <div className={cn("grid gap-2", hasSearch && "border-t pt-3")}>
      <b className="text-xs font-semibold">
        {hasSearch ? "Not searchable from here" : "From a catalog that cannot be searched here"}
      </b>
      {catalogs.map((each) => (
        <div key={each.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 flex-1">
            {each.name}{" "}
            <span className="text-muted-foreground">
              — find it there, then copy the address of the record's page
            </span>
          </span>
          {each.opacUrl !== null && (
            <Button size="sm" variant="outline" asChild>
              <a href={each.opacUrl} target="_blank" rel="noopener noreferrer">
                Open {each.name} <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
      ))}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (catalog !== undefined && link.trim() !== "") {
            read.mutate({ catalogInstanceId: catalog.id, link: link.trim() });
          }
        }}
      >
        <Input
          id={`${id}-link`}
          aria-label="Record link or ID"
          placeholder="Paste the record link, or its ID"
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
            read.reset();
          }}
          className="h-8 min-w-48 flex-1 font-mono text-xs"
        />
        {catalogs.length > 1 && (
          <Select value={catalog?.id} onValueChange={setCatalogId}>
            <SelectTrigger size="sm" aria-label="In the catalog" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalogs.map((each) => (
                <SelectItem key={each.id} value={each.id}>
                  {each.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={link.trim() === "" || read.isPending}
        >
          Add
        </Button>
      </form>
      {refusal !== null && <p className="text-xs text-destructive">{refusal}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- barcode scan

type ScanMode = "scanner" | "camera";

export function BarcodeWay({
  canScanWithCamera,
  onAdd,
}: {
  canScanWithCamera: boolean;
  onAdd: Add;
}) {
  const rules = useIdentifierRules();
  const [mode, setMode] = useState<ScanMode | null>(null);
  const [scanned, setScanned] = useState(0);
  const [last, setLast] = useState<string | null>(null);

  // One scan: added at once, as whatever type it is, and the next awaited.
  const scan = (code: string) => {
    const value = code.trim();
    if (value === "") {
      return;
    }

    onAdd(
      [{ ...readIdentifier(rules, value, null), unit: null, reason: null }],
      mode === "camera" ? "barcode · camera" : "barcode",
    );
    setScanned((count) => count + 1);
    setLast(value);
  };

  if (mode === null) {
    return (
      <div className="grid place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
        <ScanBarcode className="size-6 text-muted-foreground" />
        <b className="text-sm font-semibold">Scan one book after another</b>
        <span className="max-w-md text-xs text-muted-foreground">
          Each scan is added as it arrives, with nothing to click between books. A scanner works as
          it is: it types the code and presses Enter.
        </span>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setMode("scanner");
              setScanned(0);
              setLast(null);
            }}
          >
            Start scanning
          </Button>
          {canScanWithCamera && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMode("camera");
                setScanned(0);
                setLast(null);
              }}
            >
              <Camera className="size-3.5" /> Use the camera
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border px-4 py-3">
      <p className="text-sm" aria-live="polite">
        <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-tone-green-foreground" />
        Scanning{mode === "camera" ? " with the camera" : ""} ·{" "}
        <b className="tabular-nums">{scanned}</b> this session
      </p>
      {mode === "scanner" ? (
        <ScannerField onScan={scan} onStop={() => setMode(null)} />
      ) : (
        <CameraScanner onScan={scan} />
      )}
      <p className="font-mono text-xs text-muted-foreground">
        {last === null ? "Scan the first book." : `${last} added`}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setMode(null)}>
          Stop scanning
        </Button>
        <span className="text-xs text-muted-foreground">or Esc</span>
      </div>
    </div>
  );
}

// A hardware scanner types the code and presses Enter; the field keeps the focus between books,
// and says when it lost it.
function ScannerField({ onScan, onStop }: { onScan: (code: string) => void; onStop: () => void }) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(true);
  return (
    <div className="grid gap-1">
      <Input
        autoFocus
        aria-label="Barcode"
        autoComplete="off"
        spellCheck={false}
        placeholder="waiting for a barcode…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onScan(value);
            setValue("");
          }

          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onStop();
          }
        }}
        className="h-8 font-mono"
      />
      {!isFocused && (
        <p className="text-xs text-tone-amber-foreground">
          Paused: the field lost focus. Click it to go on scanning.
        </p>
      )}
    </div>
  );
}

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeReader {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
}

type BarcodeReaderClass = new () => BarcodeReader;

const frameInterval = 250;

// The camera feeds the same loop as a scanner. A code held in front of it is added once, until a
// different one is read. Where the browser cannot read it, or the camera does not open, each book
// is photographed instead (ACT-ways-in).
function CameraScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [isPhotographed, setIsPhotographed] = useState(false);

  useEffect(() => {
    const Reader = (globalThis as { BarcodeDetector?: BarcodeReaderClass }).BarcodeDetector;
    const video = videoRef.current;
    if (Reader === undefined || navigator.mediaDevices?.getUserMedia === undefined) {
      setIsPhotographed(true);
      return;
    }

    let stream: MediaStream | null = null;
    let isStopped = false;
    let lastCode = "";
    const reader = new Reader();
    const readFrame = async () => {
      if (isStopped || video === null) {
        return;
      }

      const [code] = await reader.detect(video).catch(() => []);
      if (code !== undefined && code.rawValue !== lastCode) {
        lastCode = code.rawValue;
        onScanRef.current(code.rawValue);
      }

      window.setTimeout(() => void readFrame(), frameInterval);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (opened) => {
        stream = opened;
        if (isStopped || video === null) {
          return;
        }

        video.srcObject = opened;
        await video.play();
        void readFrame();
      })
      .catch(() => setIsPhotographed(true));
    return () => {
      isStopped = true;
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  return isPhotographed ? (
    <PhotographedBarcodes onScan={onScan} />
  ) : (
    <video ref={videoRef} muted playsInline className="max-h-56 w-full rounded-md bg-muted" />
  );
}

// One photo per book, its barcode read by the plugin on the server; each code goes into the same
// loop as a scan, and the next photo is a tap away.
export function PhotographedBarcodes({ onScan }: { onScan: (code: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUnread, setIsUnread] = useState(false);
  const read = useMutation({
    mutationFn: readBarcode,
    onSuccess: ({ code }) => {
      setIsUnread(code === null);
      if (code !== null) {
        onScan(code);
      }
    },
  });
  return (
    <div className="grid justify-items-start gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Photo of a barcode"
        onChange={(event) => {
          const photo = event.target.files?.[0];
          event.target.value = "";
          if (photo !== undefined) {
            read.mutate(photo);
          }
        }}
      />
      <Button
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={read.isPending}
        autoFocus
      >
        <Camera className="size-3.5" /> {read.isPending ? "Reading…" : "Photograph a barcode"}
      </Button>
      <p className="text-xs text-muted-foreground">
        This browser does not read the camera as it goes, so each book takes one photo.
      </p>
      {isUnread && (
        <p className="text-xs text-tone-amber-foreground">
          No barcode was read on that photo. Take another, closer and straight on.
        </p>
      )}
      {read.isError && (
        <p className="text-xs text-destructive">The photo could not be read. Take another.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- photo capture

// Not a slower barcode scan: a photo is read, the identifiers on it if there are any and its
// text if there are none, and matched to catalog records. Reading can be wrong, so the
// candidates come back with why each matched, and nothing is added until one is picked.
export function PhotoWay({ onAdd, onSearchInstead }: { onAdd: Add; onSearchInstead?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const read = useMutation({ mutationFn: readPhoto });
  const take = () => inputRef.current?.click();
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(event) => {
        const photo = event.target.files?.[0];
        event.target.value = "";
        if (photo !== undefined) {
          read.mutate(photo);
        }
      }}
    />
  );

  if (read.data !== undefined) {
    return (
      <>
        {fileInput}
        <PhotoResult
          reading={read.data}
          onAdd={(catalogId) => onAdd([catalogLine(catalogId)], "photo")}
          onRetake={take}
          onSearchInstead={onSearchInstead}
        />
      </>
    );
  }

  return (
    <div className="grid place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
      {fileInput}
      <Camera className="size-6 text-muted-foreground" />
      <b className="text-sm font-semibold">A photo of a cover, title page or catalog card</b>
      <span className="max-w-md text-xs text-muted-foreground">
        It is read, the identifiers if there are any and the title, author and year if there are
        not, and matched to catalog records for you to pick from.
      </span>
      <Button size="sm" variant="outline" onClick={take} disabled={read.isPending}>
        {read.isPending ? "Reading…" : "Take photo"}
      </Button>
      {read.isError && (
        <p className="text-xs text-destructive">The photo could not be read. Take another.</p>
      )}
    </div>
  );
}

const sureEnough = 0.8;

function PhotoResult({
  reading,
  onAdd,
  onRetake,
  onSearchInstead,
}: {
  reading: PhotoReading;
  onAdd: (catalogId: string) => void;
  onRetake: () => void;
  onSearchInstead?: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border px-4 py-3 text-sm">
      <div>
        <h3 className="text-xs font-semibold">
          Read from the photo{" "}
          <span className="font-normal text-muted-foreground">— {reading.seen}</span>
        </h3>
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {reading.read.map((field) => (
            <div key={field.label} className="flex gap-1">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd>
                {field.value}
                {field.confidence < sureEnough && (
                  <span className="ml-1 text-xs text-tone-amber-foreground">
                    {Math.round(field.confidence * 100)}%
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {!reading.hasIdentifiers && (
          <p className="mt-1 text-xs text-muted-foreground">
            No ISBN, ISSN or barcode on it: matched by the text.
          </p>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold">Records that match</h3>
        {reading.candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">None.</p>
        ) : (
          <ul>
            {reading.candidates.map((candidate) => (
              <li
                key={candidate.catalogId}
                className="flex flex-wrap items-center gap-2 border-b py-1.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">{candidate.title}</b>{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {candidate.catalogId}
                  </span>
                  <span className="block text-xs text-muted-foreground">{candidate.why}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => onAdd(candidate.catalogId)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {onSearchInstead !== undefined && (
          <Button size="sm" variant="outline" onClick={onSearchInstead}>
            None of these: search the catalog
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onRetake}>
          Take another
        </Button>
      </div>
    </div>
  );
}
