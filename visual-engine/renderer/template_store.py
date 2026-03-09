"""
Visual Engine — Template Store
Manages template folders: save, load, list, and per-slide style selection.

Storage: Supabase (user_template_folders table) + local file fallback.
"""

import os
import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional

LOCAL_STORE_DIR = Path(__file__).parent.parent / "output" / "template_store"


class TemplateFolder:
    """
    A folder containing multiple template styles extracted from reference images.

    Structure:
    {
        "id": "uuid",
        "user_id": "uuid",
        "name": "My Design Styles",
        "source": "smart-extractor-v2",
        "templates": [
            {
                "name": "dark-editorial",
                "description": "Dark background with serif fonts",
                "html": "<!DOCTYPE html>...",
                "colors": { "--bg": "#0a0a0a", ... },
                "created_at": "2026-03-09T..."
            },
            {
                "name": "minimal-modern",
                "description": "Clean white with sans-serif",
                "html": "<!DOCTYPE html>...",
                "colors": { "--bg": "#ffffff", ... },
                "created_at": "2026-03-09T..."
            }
        ],
        "created_at": "2026-03-09T...",
        "updated_at": "2026-03-09T..."
    }
    """

    def __init__(
        self,
        name: str,
        templates: list[dict],
        user_id: Optional[str] = None,
        folder_id: Optional[str] = None,
    ):
        self.id = folder_id or str(uuid.uuid4())
        self.user_id = user_id
        self.name = name
        self.templates = templates
        self.created_at = datetime.utcnow().isoformat()
        self.updated_at = self.created_at

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "source": "smart-extractor-v2",
            "templates": self.templates,
            "template_count": len(self.templates),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def get_template(self, index: int) -> Optional[dict]:
        """Get a template by index."""
        if 0 <= index < len(self.templates):
            return self.templates[index]
        return None

    def get_template_by_name(self, name: str) -> Optional[dict]:
        """Get a template by its style name."""
        for t in self.templates:
            if t.get("name") == name:
                return t
        return None


class TemplateStore:
    """
    Manages template folders with Supabase backend + local file fallback.
    """

    def __init__(self, supabase_client=None):
        self.supabase = supabase_client
        LOCAL_STORE_DIR.mkdir(parents=True, exist_ok=True)

    async def save_folder(self, folder: TemplateFolder) -> dict:
        """Save a template folder to storage."""
        data = folder.to_dict()

        if self.supabase:
            return await self._save_to_supabase(data)
        else:
            return self._save_to_local(data)

    async def get_folder(self, folder_id: str) -> Optional[dict]:
        """Load a template folder by ID."""
        if self.supabase:
            return await self._load_from_supabase(folder_id)
        else:
            return self._load_from_local(folder_id)

    async def list_folders(self, user_id: str) -> list[dict]:
        """List all template folders for a user."""
        if self.supabase:
            return await self._list_from_supabase(user_id)
        else:
            return self._list_from_local(user_id)

    async def delete_folder(self, folder_id: str) -> bool:
        """Delete a template folder."""
        if self.supabase:
            return await self._delete_from_supabase(folder_id)
        else:
            return self._delete_from_local(folder_id)

    # --- Supabase storage ---

    async def _save_to_supabase(self, data: dict) -> dict:
        """Save to user_template_folders table."""
        row = {
            "id": data["id"],
            "user_id": data["user_id"],
            "name": data["name"],
            "source": "smart-extractor-v2",
            "styles": json.dumps(data["templates"]),
            "shared_brand": json.dumps({}),
        }

        result = self.supabase.table("user_template_folders").upsert(row).execute()
        return data

    async def _load_from_supabase(self, folder_id: str) -> Optional[dict]:
        result = (
            self.supabase.table("user_template_folders")
            .select("*")
            .eq("id", folder_id)
            .single()
            .execute()
        )

        if result.data:
            row = result.data
            templates = json.loads(row["styles"]) if isinstance(row["styles"], str) else row["styles"]
            return {
                "id": row["id"],
                "user_id": row["user_id"],
                "name": row["name"],
                "source": row.get("source", "smart-extractor-v2"),
                "templates": templates,
                "template_count": len(templates),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        return None

    async def _list_from_supabase(self, user_id: str) -> list[dict]:
        result = (
            self.supabase.table("user_template_folders")
            .select("id, name, source, created_at, updated_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    async def _delete_from_supabase(self, folder_id: str) -> bool:
        self.supabase.table("user_template_folders").delete().eq("id", folder_id).execute()
        return True

    # --- Local file storage (fallback) ---

    def _save_to_local(self, data: dict) -> dict:
        path = LOCAL_STORE_DIR / f"{data['id']}.json"
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        return data

    def _load_from_local(self, folder_id: str) -> Optional[dict]:
        path = LOCAL_STORE_DIR / f"{folder_id}.json"
        if path.exists():
            with open(path) as f:
                return json.load(f)
        return None

    def _list_from_local(self, user_id: str) -> list[dict]:
        folders = []
        for path in LOCAL_STORE_DIR.glob("*.json"):
            with open(path) as f:
                data = json.load(f)
                if data.get("user_id") == user_id or user_id is None:
                    folders.append({
                        "id": data["id"],
                        "name": data["name"],
                        "template_count": data.get("template_count", 0),
                        "source": data.get("source", ""),
                        "created_at": data.get("created_at", ""),
                    })
        return sorted(folders, key=lambda x: x.get("created_at", ""), reverse=True)

    def _delete_from_local(self, folder_id: str) -> bool:
        path = LOCAL_STORE_DIR / f"{folder_id}.json"
        if path.exists():
            path.unlink()
            return True
        return False


class SlideStyleSelector:
    """
    Allows users to assign different template styles to different slides.

    Example:
        folder has 3 styles: ["dark-editorial", "minimal-modern", "bold-gradient"]
        User creates 7-slide carousel:
            Slide 0 (cover)   → style "bold-gradient"
            Slide 1 (content) → style "dark-editorial"
            Slide 2 (content) → style "dark-editorial"
            Slide 3 (content) → style "minimal-modern"
            Slide 4 (content) → style "dark-editorial"
            Slide 5 (content) → style "minimal-modern"
            Slide 6 (cta)     → style "bold-gradient"
    """

    def __init__(self, folder: TemplateFolder):
        self.folder = folder
        self.assignments: dict[int, str] = {}  # slide_index → template_name

    def assign(self, slide_index: int, template_name: str):
        """Assign a template style to a slide."""
        template = self.folder.get_template_by_name(template_name)
        if template is None:
            raise ValueError(f"Template '{template_name}' not found in folder")
        self.assignments[slide_index] = template_name

    def assign_all(self, template_name: str, num_slides: int):
        """Assign the same template to all slides."""
        for i in range(num_slides):
            self.assign(i, template_name)

    def get_template_for_slide(self, slide_index: int) -> Optional[dict]:
        """Get the assigned template for a specific slide."""
        name = self.assignments.get(slide_index)
        if name:
            return self.folder.get_template_by_name(name)
        # Default: use first template
        return self.folder.get_template(0)

    def get_assignments(self) -> dict:
        """Get all slide → template assignments."""
        return dict(self.assignments)
