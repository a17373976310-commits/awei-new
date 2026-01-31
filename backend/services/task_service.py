import uuid
import time
from typing import Dict, Any, Optional

class TaskService:
    def __init__(self):
        # In-memory storage for tasks
        # In production, this should be Redis or a database
        self.tasks: Dict[str, Dict[str, Any]] = {}

    def create_task(self, task_type: str = "image_generation") -> str:
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "id": task_id,
            "type": task_type,
            "status": "pending",
            "progress": 0,
            "progress_message": "初始化...",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "updated_at": time.time()
        }
        return task_id

    def update_task(self, task_id: str, status: str = None, progress: int = None, progress_message: str = None, result: Any = None, error: str = None):
        if task_id not in self.tasks:
            return
        
        task = self.tasks[task_id]
        if status:
            task["status"] = status
        if progress is not None:
            task["progress"] = progress
        if progress_message is not None:
            task["progress_message"] = progress_message
        if result is not None:
            task["result"] = result
        if error is not None:
            task["error"] = error
        
        task["updated_at"] = time.time()

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self.tasks.get(task_id)

    def cleanup_old_tasks(self, max_age_seconds: int = 3600):
        """Remove tasks older than max_age_seconds"""
        now = time.time()
        to_delete = [tid for tid, t in self.tasks.items() if now - t["created_at"] > max_age_seconds]
        for tid in to_delete:
            del self.tasks[tid]

task_service = TaskService()
