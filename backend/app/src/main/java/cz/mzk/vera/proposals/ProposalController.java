package cz.mzk.vera.proposals;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.LinkReader;
import cz.mzk.vera.plugin.catalog.ReadLinkAnswer;
import cz.mzk.vera.plugin.catalog.ReadLinkInput;
import cz.mzk.vera.plugin.input.BarcodeReader;
import cz.mzk.vera.plugin.input.Input;
import cz.mzk.vera.plugin.input.PhotoReader;
import cz.mzk.vera.plugin.input.ReadBarcodeAnswer;
import cz.mzk.vera.plugin.input.ReadBarcodeInput;
import cz.mzk.vera.plugin.input.ReadPhotoAnswer;
import cz.mzk.vera.plugin.input.ReadPhotoInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

// ACT-propose; ACT-ways-in; ROLE-library-day: proposal reads and the plugin ways in.
@RestController
@RequestMapping("/api/proposals")
final class ProposalController {
    private final AccessGuard guard;
    private final HeldAccessQueries access;
    private final ProposalSettings settings;
    private final ProposalCheck check;
    private final ProposalWaysIn waysIn;
    private final PluginCalls plugins;
    private final ProposalSubmit submit;

    ProposalController(AccessGuard guard, HeldAccessQueries access, ProposalSettings settings,
            ProposalCheck check, ProposalWaysIn waysIn, PluginCalls plugins, ProposalSubmit submit) {
        this.guard = guard;
        this.access = access;
        this.settings = settings;
        this.check = check;
        this.waysIn = waysIn;
        this.plugins = plugins;
        this.submit = submit;
    }

    @PostMapping
    ResponseEntity<?> submit(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        ProposalSubmit.Outcome outcome = submit.submit(caller, body);
        if (outcome.detail() != null) {
            return Problems.response(outcome.status(), outcome.detail(), outcome.code(), null);
        }
        return ResponseEntity.status(outcome.status()).body(outcome.body());
    }

    @GetMapping("/settings")
    ResponseEntity<?> settings(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        return refusal == null ? ResponseEntity.ok(settings.settings(caller.userId())) : refusal;
    }

    @GetMapping("/rate-limit")
    ResponseEntity<?> rateLimit(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        return refusal == null ? ResponseEntity.ok(settings.rateLimit(caller.userId())) : refusal;
    }

    @PostMapping("/lookup")
    ResponseEntity<?> lookup(HttpServletRequest request, @RequestBody Map<String, List<Map<String, Object>>> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = proposingRefusal(caller);
        if (refusal != null) {
            return refusal;
        }
        return ResponseEntity.ok(check.lookupItems(body.getOrDefault("items", List.of()), caller.userId()));
    }

    @GetMapping("/catalog-search")
    ResponseEntity<?> catalogSearch(HttpServletRequest request,
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(name = "catalog", required = false) String catalog) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = proposingRefusal(caller);
        return refusal == null ? ResponseEntity.ok(waysIn.search(query, catalog)) : refusal;
    }

    @PostMapping("/record-link")
    ResponseEntity<?> recordLink(HttpServletRequest request, @RequestBody Map<String, String> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = proposingRefusal(caller);
        if (refusal != null) {
            return refusal;
        }
        String instanceId = body.get("catalogInstanceId");
        if (!waysIn.isEnabledCatalog(instanceId)) {
            return Problems.response(404, "No such catalog to read a link in");
        }
        PluginOutcome<ReadLinkAnswer> outcome = plugins.call(instanceId,
                CatalogAdapter.class, ProposalCodes.READ_LINK,
                (reader, context) -> ((LinkReader) reader).readLink(
                        context, new ReadLinkInput(body.get("link"))));
        if (outcome instanceof PluginOutcome.Answered<ReadLinkAnswer> answer) {
            return ResponseEntity.ok(Map.of("catalogId", answer.answer().catalogId()));
        }
        String detail = waysIn.catalogName(instanceId) + " reads no record in that";
        return Problems.response(422, detail, ProposalCodes.LINK_UNREAD, null);
    }

    @PostMapping(value = "/barcode", consumes = "multipart/form-data")
    ResponseEntity<?> barcode(HttpServletRequest request, @RequestParam(name = "photo", required = false)
            MultipartFile photo) throws IOException {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = proposingRefusal(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!waysIn.hasEnabledInput(ProposalCodes.READ_BARCODE)) {
            return Problems.response(404, "Nothing reads barcodes here", ProposalCodes.NO_BARCODE_READER, null);
        }
        if (photo == null) {
            return Problems.response(422, "Photograph a barcode to read", ProposalCodes.PHOTO_MISSING, null);
        }
        String instance = waysIn.firstInput(ProposalCodes.READ_BARCODE);
        String encodedPhoto = Base64.getEncoder().encodeToString(photo.getBytes());
        var outcome = plugins.call(instance, Input.class, ProposalCodes.READ_BARCODE,
                (reader, context) -> ((BarcodeReader) reader).readBarcode(context,
                        new ReadBarcodeInput(encodedPhoto)));
        if (outcome instanceof PluginOutcome.Answered<ReadBarcodeAnswer> answer) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("code", answer.answer().value());
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.ok(Map.of("code", ""));
    }

    @PostMapping(value = "/photo", consumes = "multipart/form-data")
    ResponseEntity<?> photo(HttpServletRequest request, @RequestParam(name = "photo", required = false)
            MultipartFile photo) throws IOException {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = proposingRefusal(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!waysIn.hasEnabledInput(ProposalCodes.READ_PHOTO)) {
            return Problems.response(404, "Nothing reads photos here", ProposalCodes.NO_PHOTO_READER, null);
        }
        if (photo == null) {
            return Problems.response(422, "Take a photo to read", ProposalCodes.PHOTO_MISSING, null);
        }
        String instance = waysIn.firstInput(ProposalCodes.READ_PHOTO);
        String encodedPhoto = Base64.getEncoder().encodeToString(photo.getBytes());
        var outcome = plugins.call(instance, Input.class, ProposalCodes.READ_PHOTO,
                (reader, context) -> ((PhotoReader) reader).readPhoto(context,
                        new ReadPhotoInput(encodedPhoto)));
        if (outcome instanceof PluginOutcome.Answered<ReadPhotoAnswer> answer) {
            var value = answer.answer();
            List<Map<String, Object>> read = value.values().stream().map(each -> Map.<String, Object>of(
                    "label", each.label(), "value", each.value(), "confidence", each.confidence())).toList();
            List<Map<String, Object>> candidates = value.candidates().stream().map(each -> Map.<String, Object>of(
                    "catalogId", each.catalogId(), "title", each.title(), "why", each.why())).toList();
            return ResponseEntity.ok(Map.of("seen", value.seen(), "read", read,
                    "hasIdentifiers", false, "candidates", candidates));
        }
        return ResponseEntity.ok(Map.of("seen", "", "read", List.of(), "hasIdentifiers", false,
                "candidates", List.of()));
    }

    private ResponseEntity<ProblemDetail> proposingRefusal(Caller caller) {
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!Permissions.hasPermission(access.heldBy(caller.userId()).grants(),
                ProposalCodes.REQUEST_CREATE)) {
            return Problems.response(403, "You may not propose");
        }
        return null;
    }
}
