#!/bin/sh
# Trava de segredos: barra commit e push que carreguem senha, token ou chave (gitleaks).
# Uso: segredos.sh staged            -> confere o que esta preparado para o commit
#      segredos.sh push <remoto>     -> confere os commits que vao subir (le as linhas do pre-push no stdin)
# Falso positivo: marque a linha com o comentario `gitleaks:allow` ou registre a impressao digital em .gitleaksignore.

achar_gitleaks() {
  if command -v gitleaks >/dev/null 2>&1; then
    echo gitleaks
    return 0
  fi
  # Windows: o winget instala fora do PATH de shells abertos antes da instalacao.
  if [ -n "$LOCALAPPDATA" ] && command -v cygpath >/dev/null 2>&1; then
    base=$(cygpath -u "$LOCALAPPDATA")/Microsoft/WinGet
    for candidato in "$base/Links/gitleaks.exe" "$base"/Packages/Gitleaks.Gitleaks_*/gitleaks.exe; do
      if [ -x "$candidato" ]; then
        echo "$candidato"
        return 0
      fi
    done
  fi
  return 1
}

GITLEAKS=$(achar_gitleaks)
if [ -z "$GITLEAKS" ]; then
  echo "AVISO: gitleaks nao esta instalado; a trava de segredos NAO rodou." >&2
  echo "       Windows: winget install Gitleaks.Gitleaks | Linux: https://github.com/gitleaks/gitleaks/releases" >&2
  exit 0
fi

barrar() {
  echo "" >&2
  echo "BLOQUEADO: o gitleaks achou um possivel segredo $1." >&2
  echo "Tire o valor do arquivo e leia-o de variavel de ambiente. Se o segredo ja foi salvo antes, ele precisa ser trocado na origem." >&2
  echo "Falso positivo: comente a linha com gitleaks:allow ou registre em .gitleaksignore." >&2
  exit 1
}

case "$1" in
  staged)
    "$GITLEAKS" git --pre-commit --staged --redact --no-banner --log-level error || barrar "no que voce ia salvar"
    ;;
  push)
    remoto=${2:-origin}
    zeros=0000000000000000000000000000000000000000
    while read -r _ref_local sha_local _ref_remoto sha_remoto; do
      [ "$sha_local" = "$zeros" ] && continue
      if [ "$sha_remoto" = "$zeros" ]; then
        intervalo="$sha_local --not --remotes=$remoto"
      else
        intervalo="$sha_remoto..$sha_local"
      fi
      "$GITLEAKS" git --redact --no-banner --log-level error --log-opts="$intervalo" || barrar "nos commits que iam subir"
    done
    ;;
  *)
    echo "uso: segredos.sh staged | segredos.sh push <remoto>" >&2
    exit 2
    ;;
esac
