package kr.doran;
import java.util.*;
import org.apache.ibatis.annotations.*;
@org.apache.ibatis.annotations.Mapper
public interface Mapper {
    List<Map<String,Object>> history(@Param("room") long room, @Param("before") Long before, @Param("after") Long after);
}
