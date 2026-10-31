// The propose dialog's ways in beyond typing, pasting and a file (ACT-ways-in;
// docs/demos/shared/page-documents.js `wayPanel`). Catalog search over the catalogs that can be
// searched, and below it the record link or ID for any catalog (a link already copied needs no
// search). Barcode scanning is
// continuous: a hardware scanner types the code and presses Enter, so a focused field that adds
// on Enter and waits is the whole of it, and the camera feeds the same loop while an Input
// plugin reads barcodes: continuously where the browser reads them, otherwise one photo per book
// that the plugin reads on the server. A photo is read and matched to catalog records, and nothing is added
// until one is picked. Each way is shown only while its plugin is enabled
// (PERM-absent-not-disabled); the dialog decides which.

import { useMutation, useQuery } from "@tanstack/react-query";
import type { PhotoReading, ProposalSettings } from "@vera/contract/proposals";
import type { ProposalLine } from "@vera/domain/proposals";
import { readIdentifier } from "@vera/domain/proposals";
import { Camera, ExternalLink, ScanBarcode } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/http";
import { readBarcode, readPhoto, readRecordLink, searchCatalogs } from "@/api/proposals";
import { useFilePicker } from "@/components/fields/file-picker";
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
import { i18n } from "@/i18n";
import { cn } from "@/lib/utils";

type Add = (lines: ProposalLine[], source: string) => void;

const allCatalogs = "all";

function catalogLine(catalogId: string): ProposalLine {
  return { type: "catalogId", candidateTypes: [], value: catalogId, unit: null, reason: null };
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
  useTranslation("documents");
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
              aria-label={i18n.t("proposeWays.searchCatalog", { ns: "documents" })}
              placeholder={i18n.t("proposeWays.searchPlaceholder", { ns: "documents" })}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="h-8 min-w-48 flex-1"
            />
            {catalogs.length > 1 && (
              <Select value={catalogId} onValueChange={setCatalogId}>
                <SelectTrigger
                  size="sm"
                  aria-label={i18n.t("proposeWays.catalog", { ns: "documents" })}
                  className="w-48"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allCatalogs}>
                    {i18n.t("proposeWays.allCatalogs", { ns: "documents", count: catalogs.length })}
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
              {i18n.t("proposeWays.search", { ns: "documents" })}
            </Button>
          </form>
          {query !== "" && hits !== undefined && hits.length === 0 && !isFetching && (
            <p className="text-xs text-muted-foreground">
              {i18n.t("proposeWays.nothingFound", { ns: "documents", query })}
            </p>
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
                        ·{" "}
                        {i18n.t("proposeWays.volumeOrIssue", {
                          ns: "documents",
                          count: hit.units.length,
                        })}
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
                      onAdd(
                        [catalogLine(hit.catalogId)],
                        i18n.t("proposeWays.catalogSearchSource", {
                          ns: "documents",
                          name: hit.catalog.name,
                        }),
                      )
                    }
                  >
                    {i18n.t("proposeWays.add", { ns: "documents" })}
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

// A record's link or ID in any catalog: the person found it there, or already has it, and pastes
// it; the catalog adapter reads it.
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
      onAdd(
        [catalogLine(recordId)],
        i18n.t("proposeWays.recordLinkSource", { ns: "documents", name: catalog?.name ?? "" }),
      );
      setLink("");
    },
  });
  const refusal =
    read.error instanceof ApiError && read.error.status === 422
      ? i18n.t("proposeWays.recordNotFound", {
          ns: "documents",
          catalog: catalog?.name ?? i18n.t("proposeWays.theCatalog", { ns: "documents" }),
        })
      : read.isError
        ? i18n.t("proposeWays.couldNotRead", { ns: "documents" })
        : null;

  return (
    <div className={cn("grid gap-2", hasSearch && "border-t pt-3")}>
      <b className="text-xs font-semibold">
        {hasSearch
          ? i18n.t("proposeWays.orPasteRecord", { ns: "documents" })
          : i18n.t("proposeWays.pasteRecord", { ns: "documents" })}
      </b>
      {catalogs.map((each) => (
        <div key={each.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 flex-1">
            {each.name}{" "}
            <span className="text-muted-foreground">
              — {i18n.t("proposeWays.findAndCopy", { ns: "documents" })}
            </span>
          </span>
          {each.opacUrl !== null && (
            <Button size="sm" variant="outline" asChild>
              <a href={each.opacUrl} target="_blank" rel="noopener noreferrer">
                {i18n.t("proposeWays.openCatalog", { ns: "documents", name: each.name })}{" "}
                <ExternalLink className="size-3.5" />
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
          aria-label={i18n.t("proposeWays.recordLink", { ns: "documents" })}
          placeholder={i18n.t("proposeWays.recordLinkPlaceholder", { ns: "documents" })}
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
            read.reset();
          }}
          className="h-8 min-w-48 flex-1 font-mono text-xs"
        />
        {catalogs.length > 1 && (
          <Select value={catalog?.id} onValueChange={setCatalogId}>
            <SelectTrigger
              size="sm"
              aria-label={i18n.t("proposeWays.inCatalog", { ns: "documents" })}
              className="w-40"
            >
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
          {i18n.t("proposeWays.add", { ns: "documents" })}
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
  useTranslation("documents");
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
      i18n.t(mode === "camera" ? "proposeWays.barcodeCameraSource" : "proposeWays.barcodeSource", {
        ns: "documents",
      }),
    );
    setScanned((count) => count + 1);
    setLast(value);
  };

  if (mode === null) {
    return (
      <div className="grid place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
        <ScanBarcode className="size-6 text-muted-foreground" />
        <b className="text-sm font-semibold">
          {i18n.t("proposeWays.scanBooks", { ns: "documents" })}
        </b>
        <span className="max-w-md text-xs text-muted-foreground">
          {i18n.t("proposeWays.scannerDescription", { ns: "documents" })}
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
            {i18n.t("proposeWays.startScanning", { ns: "documents" })}
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
              <Camera className="size-3.5" /> {i18n.t("proposeWays.useCamera", { ns: "documents" })}
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
        {i18n.t(mode === "camera" ? "proposeWays.scanningCamera" : "proposeWays.scanning", {
          ns: "documents",
        })}{" "}
        · <b className="tabular-nums">{scanned}</b>{" "}
        {i18n.t("proposeWays.thisSession", { ns: "documents" })}
      </p>
      {mode === "scanner" ? (
        <ScannerField onScan={scan} onStop={() => setMode(null)} />
      ) : (
        <CameraScanner onScan={scan} />
      )}
      <p className="font-mono text-xs text-muted-foreground">
        {last === null
          ? i18n.t("proposeWays.scanFirst", { ns: "documents" })
          : i18n.t("proposeWays.added", { ns: "documents", value: last })}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setMode(null)}>
          {i18n.t("proposeWays.stopScanning", { ns: "documents" })}
        </Button>
        <span className="text-xs text-muted-foreground">
          {i18n.t("proposeWays.orEsc", { ns: "documents" })}
        </span>
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
        aria-label={i18n.t("proposeWays.barcode", { ns: "documents" })}
        autoComplete="off"
        spellCheck={false}
        placeholder={i18n.t("proposeWays.waitingBarcode", { ns: "documents" })}
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
          {i18n.t("proposeWays.pausedScanning", { ns: "documents" })}
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
  useTranslation("documents");
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
  const picker = useFilePicker({
    accept: "image/*",
    capture: "environment",
    label: i18n.t("proposeWays.photoBarcode", { ns: "documents" }),
    onFile: (photo) => read.mutate(photo),
  });
  return (
    <div className="grid justify-items-start gap-1.5">
      {picker.input}
      <Button size="sm" onClick={picker.open} disabled={read.isPending} autoFocus>
        <Camera className="size-3.5" />{" "}
        {read.isPending
          ? i18n.t("proposeWays.reading", { ns: "documents" })
          : i18n.t("proposeWays.photographBarcode", { ns: "documents" })}
      </Button>
      <p className="text-xs text-muted-foreground">
        {i18n.t("proposeWays.browserNeedsPhoto", { ns: "documents" })}
      </p>
      {isUnread && (
        <p className="text-xs text-tone-amber-foreground">
          {i18n.t("proposeWays.noBarcodePhoto", { ns: "documents" })}
        </p>
      )}
      {read.isError && (
        <p className="text-xs text-destructive">
          {i18n.t("proposeWays.photoUnreadable", { ns: "documents" })}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- photo capture

// Not a slower barcode scan: a photo is read, the identifiers on it if there are any and its
// text if there are none, and matched to catalog records. Reading can be wrong, so the
// candidates come back with why each matched, and nothing is added until one is picked.
export function PhotoWay({ onAdd, onSearchInstead }: { onAdd: Add; onSearchInstead?: () => void }) {
  useTranslation("documents");
  const read = useMutation({ mutationFn: readPhoto });
  const picker = useFilePicker({
    accept: "image/*",
    capture: "environment",
    onFile: (photo) => read.mutate(photo),
  });
  const take = picker.open;
  const fileInput = picker.input;

  if (read.data !== undefined) {
    return (
      <>
        {fileInput}
        <PhotoResult
          reading={read.data}
          onAdd={(catalogId) =>
            onAdd([catalogLine(catalogId)], i18n.t("proposeWays.photoSource", { ns: "documents" }))
          }
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
      <b className="text-sm font-semibold">
        {i18n.t("proposeWays.photoWhat", { ns: "documents" })}
      </b>
      <span className="max-w-md text-xs text-muted-foreground">
        {i18n.t("proposeWays.photoDescription", { ns: "documents" })}
      </span>
      <Button size="sm" variant="outline" onClick={take} disabled={read.isPending}>
        {read.isPending
          ? i18n.t("proposeWays.reading", { ns: "documents" })
          : i18n.t("proposeWays.takePhoto", { ns: "documents" })}
      </Button>
      {read.isError && (
        <p className="text-xs text-destructive">
          {i18n.t("proposeWays.photoUnreadable", { ns: "documents" })}
        </p>
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
          {i18n.t("proposeWays.readFromPhoto", { ns: "documents" })}{" "}
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
            {i18n.t("proposeWays.noIdMatchedText", { ns: "documents" })}
          </p>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold">
          {i18n.t("proposeWays.matchingRecords", { ns: "documents" })}
        </h3>
        {reading.candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {i18n.t("proposeWays.none", { ns: "documents" })}
          </p>
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
            {i18n.t("proposeWays.noneSearchCatalog", { ns: "documents" })}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onRetake}>
          {i18n.t("proposeWays.takeAnother", { ns: "documents" })}
        </Button>
      </div>
    </div>
  );
}
