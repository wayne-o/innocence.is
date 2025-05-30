using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using InnocenceAPI.Models;

namespace InnocenceAPI.Data
{
    public class ComplianceContext : DbContext
    {
        public ComplianceContext(DbContextOptions<ComplianceContext> options)
            : base(options)
        {
        }

        public DbSet<EnhancedCertificate> Certificates { get; set; }
        public DbSet<AssetInfo> Assets { get; set; }
        public DbSet<SanctionEntry> SanctionEntries { get; set; }
        public DbSet<ComplianceLog> ComplianceLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<EnhancedCertificate>()
                .HasKey(c => c.Id);

            modelBuilder.Entity<EnhancedCertificate>()
                .Property(c => c.AllowedAssets)
                .HasConversion(
                    v => string.Join(',', v),
                    v => v.Split(',', StringSplitOptions.RemoveEmptyEntries)
                          .Select(s => System.Numerics.BigInteger.Parse(s))
                          .ToList()
                );

            modelBuilder.Entity<EnhancedCertificate>()
                .Property(c => c.MaxPositionSize)
                .HasConversion(
                    v => v.ToString(),
                    v => System.Numerics.BigInteger.Parse(v)
                );

            // Configure AssetInfo entity
            modelBuilder.Entity<AssetInfo>(entity =>
            {
                // Use AssetIdBigInt as the key, stored as string in database
                entity.HasKey(a => a.AssetIdBigInt);
                
                entity.Property(a => a.AssetIdBigInt)
                    .HasConversion(
                        v => v.ToString(),
                        v => System.Numerics.BigInteger.Parse(v)
                    );
                
                // Ignore the string AssetId property (it's computed)
                entity.Ignore(a => a.AssetId);
            });

            modelBuilder.Entity<SanctionEntry>()
                .HasKey(s => s.Id);

            modelBuilder.Entity<ComplianceLog>()
                .HasKey(l => l.Id);
        }
    }

    public class SanctionEntry
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Address { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty; // OFAC, UN, EU, etc.
        public DateTime AddedDate { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Reason { get; set; }
    }

    public class ComplianceLog
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Address { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public bool Result { get; set; }
        public string? CertificateId { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? Details { get; set; }
    }
}