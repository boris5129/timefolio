package timefolio;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ApiError.class)
    ResponseEntity<Map<String,String>> domain(ApiError error) {
        return ResponseEntity.status(error.status).body(Map.of("message", error.getMessage()));
    }

    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,
        HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class})
    ResponseEntity<Map<String,String>> invalid(Exception error) {
        return domain(new ApiError(400, "입력값의 형식과 길이를 확인해 주세요."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String,String>> conflict(Exception error) {
        return domain(new ApiError(409, "중복되거나 다른 기록에서 사용 중인 데이터입니다."));
    }
}

class ApiError extends RuntimeException {
    final int status;

    ApiError(int status, String message) {
        super(message);
        this.status = status;
    }
}
