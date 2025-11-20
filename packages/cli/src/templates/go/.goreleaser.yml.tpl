# GoReleaser configuration
project_name: {{projectName}}

before:
  hooks:
    - go mod tidy
    - go generate ./...

builds:
  - env:
      - CGO_ENABLED=0
    goos:
      - linux
      - windows
      - darwin
    goarch:
      - amd64
      - arm64
    main: ./cmd/main.go
    binary: app
    ldflags:
      - -s -w -X main.version={{`{{.Version}}`}} -X main.commit={{`{{.Commit}}`}} -X main.date={{`{{.Date}}`}}

archives:
  - format: tar.gz
    name_template: >-
      {{`{{ .ProjectName }}`}}_
      {{`{{- title .Os }}`}}_
      {{`{{- if eq .Arch "amd64" }}`} x86_64
      {{`{{- else if eq .Arch "386" }}`} i386
      {{`{{- else }}`}{{`{{ .Arch }}`}}{{`{{ end }}`}}
    format_overrides:
      - goos: windows
        format: zip

checksum:
  name_template: "checksums.txt"

changelog:
  sort: asc
  filters:
    exclude:
      - '^docs:'
      - '^test:'
