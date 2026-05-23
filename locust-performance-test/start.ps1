$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

function Invoke-DockerCli {
  param([string[]]$Args)

  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if ($docker) {
    & docker @Args
    return
  }

  wsl docker @Args
}

$networkExists = Invoke-DockerCli @("network", "inspect", "node-api-connect") 2>$null
if (-not $networkExists) {
  Invoke-DockerCli @("network", "create", "node-api-connect")
}

Invoke-DockerCli @(
  "rm", "-f",
  "locust-master", "locust-worker",
  "locust-performance-test_master_1", "locust-performance-test_worker_1"
) 2>$null | Out-Null

if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker compose up -d --force-recreate
} else {
  wsl bash -lc "cd '$(wsl wslpath -a $PSScriptRoot)' && docker compose up -d --force-recreate"
}

Write-Host ""
Write-Host "Locust disponível em: http://localhost:8089"
Write-Host "Host da API (já configurado): http://node-api:4444"
Write-Host ""
Write-Host "Logs: docker compose logs -f master worker"
