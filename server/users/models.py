from sqlalchemy import Column, ForeignKey, Integer, String

from services.database import Base


class UserView(Base):
    __tablename__ = 'user_view'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), index=True)

    department_abbreviation = Column(String,
                                     ForeignKey("departments.abbreviation"))
    department_name = Column(String, ForeignKey("departments.name"))
    role_name = Column(String, ForeignKey("roles.name"))
