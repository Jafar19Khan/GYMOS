output "instance_id" {
  description = "EC2 instance ID for the PowerShell SSM scripts."
  value       = aws_instance.gymos.id
}
output "public_ip" {
  description = "Ephemeral public IPv4 address; the certificate refreshes after stop/start."
  value       = aws_instance.gymos.public_ip
}
output "app_url" {
  description = "HTTPS URL using a temporary self-signed certificate for evaluation."
  value       = "https://${aws_instance.gymos.public_ip}"
}
output "security_group_id" {
  value = aws_security_group.web.id
}
output "aws_region" {
  value = var.aws_region
}
