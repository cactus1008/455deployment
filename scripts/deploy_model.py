#!/usr/bin/env python3
"""
Deploy a staged model version to production.
Copies model artifacts from versioned folder to production folder.

Usage:
  python scripts/deploy_model.py <version_name>

Example:
  python scripts/deploy_model.py xgboost_v20250402_020000
"""

import sys
import shutil
import os
from pathlib import Path

def deploy_model(version_name):
    """Copy model artifacts from versioned folder to production."""
    
    model_dir = Path(f"python/models/{version_name}")
    prod_dir = Path("python")
    
    if not model_dir.exists():
        print(f"❌ Model version {version_name} not found in {model_dir}")
        return False
    
    artifacts = [
        "xgboost_model.joblib",
        "train_columns.joblib",
        "num_imputer.joblib",
        "cat_imputer.joblib",
        "scaler.joblib"
    ]
    
    # Backup current production model
    print("Creating backup of current production model...")
    for artifact in artifacts:
        src = prod_dir / artifact
        if src.exists():
            backup = prod_dir / f"{artifact}.backup"
            shutil.copy2(src, backup)
            print(f"  ✓ Backed up {artifact}")
    
    # Copy new model to production
    print(f"\nDeploying {version_name}...")
    missing = []
    for artifact in artifacts:
        src = model_dir / artifact
        dst = prod_dir / artifact
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  ✓ Deployed {artifact}")
        else:
            missing.append(artifact)
    
    if missing:
        print(f"\n⚠️  WARNING: Missing artifacts: {', '.join(missing)}")
        print("   Deployment may be incomplete!")
        return False
    
    print(f"\n✅ Successfully deployed {version_name} to production!")
    print(f"   All model files are now active")
    return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/deploy_model.py <version_name>")
        print("\nList available versions:")
        models_dir = Path("python/models")
        if models_dir.exists():
            versions = [d.name for d in models_dir.iterdir() if d.is_dir()]
            if versions:
                for v in sorted(versions, reverse=True)[:10]:
                    print(f"  - {v}")
            else:
                print("  (No trained models found)")
        else:
            print("  (Models directory not found)")
        sys.exit(1)
    
    version = sys.argv[1]
    success = deploy_model(version)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
