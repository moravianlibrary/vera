{{- define "vera.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
{{- define "vera.backendImage" -}}
{{ .Values.vera.image.backend.repository }}:{{ default .Chart.AppVersion .Values.vera.image.backend.tag }}
{{- end -}}
{{- define "vera.frontendImage" -}}
{{ .Values.vera.image.frontend.repository }}:{{ default .Chart.AppVersion .Values.vera.image.frontend.tag }}
{{- end -}}
{{- define "vera.secretName" -}}
{{ default (printf "%s-config" .Release.Name) .Values.vera.existingSecret }}
{{- end -}}

{{- /* Migrates the database before a backend container starts (VERA_ROLE=migrate); Liquibase's lock lets one pod at a time do it. */ -}}
{{- define "vera.migrateInit" -}}
initContainers:
  - name: migrate
    image: {{ include "vera.backendImage" . | quote }}
    imagePullPolicy: {{ .Values.vera.image.backend.pullPolicy }}
    env:
      - name: VERA_ROLE
        value: migrate
      - name: VERA_DB_URL
        value: jdbc:postgresql://{{ .Release.Name }}-postgres-rw:5432/vera
      - name: VERA_DB_USER
        valueFrom:
          secretKeyRef:
            name: {{ .Release.Name }}-postgres-app
            key: username
      - name: VERA_DB_PASSWORD
        valueFrom:
          secretKeyRef:
            name: {{ .Release.Name }}-postgres-app
            key: password
{{- end }}
